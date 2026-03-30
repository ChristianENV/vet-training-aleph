import { AiUsageLogStatus, SessionStatus, TranscriptStatus } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getServerEnv } from "@/lib/config/env";
import {
  estimateOpenAiMiniCostUsdFromUsage,
  runSessionQuestionGenerationModel,
} from "@/modules/openai/application/run-session-question-generation";
import { getQuestionsModelName } from "@/modules/openai/infrastructure/openai-client";
import {
  recordQuestionGenerationAiUsage,
  recordQuestionGenerationIncident,
} from "@/modules/sessions/infrastructure/session-question-generation-logging";
import { resolveSessionResponseForQuestion } from "@/modules/sessions/domain/resolve-session-response-for-question";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";
import * as templateRepo from "@/modules/sessions/infrastructure/session-template-repository";
import type {
  CreateSessionBody,
  SessionListQuery,
  SubmitSessionResponseBody,
} from "@/modules/sessions/validators/sessions";

export class SessionsServiceError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 422 | 500 | 502 | 503,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SessionsServiceError";
  }
}

export type SessionProgressSnapshot = {
  totalQuestions: number;
  answeredCount: number;
  currentQuestionId: string | null;
  completionPercent: number;
};

type QuestionProgressInput = { id: string; ordinal: number; isRequired: boolean };
type ResponseProgressInput = {
  sessionQuestionId: string;
  transcriptText: string | null;
  finalAudioStorageKey: string | null;
  finalAudioDurationSec?: number | null;
};

/**
 * Progress uses persisted session questions (GPT-generated per session).
 * "Answered" = transcript, uploaded audio key, or in-browser capture metadata pending upload.
 */
export function computeSessionProgress(session: {
  sessionQuestions: QuestionProgressInput[];
  responses: ResponseProgressInput[];
}): SessionProgressSnapshot {
  const ordered = [...session.sessionQuestions].sort((a, b) => a.ordinal - b.ordinal);
  const total = ordered.length;
  const byId = new Map(session.responses.map((r) => [r.sessionQuestionId, r]));

  let answeredCount = 0;
  let currentQuestionId: string | null = null;

  for (const q of ordered) {
    const r = byId.get(q.id);
    if (responseHasContent(r)) {
      answeredCount++;
    } else if (currentQuestionId === null) {
      currentQuestionId = q.id;
    }
  }

  const completionPercent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);
  return {
    totalQuestions: total,
    answeredCount,
    currentQuestionId,
    completionPercent,
  };
}

function assertSequentialResponseAllowed(
  block: { questions: QuestionProgressInput[] },
  responses: ResponseProgressInput[],
  targetQuestionId: string,
): void {
  const ordered = [...block.questions].sort((a, b) => a.ordinal - b.ordinal);
  const byId = new Map(responses.map((r) => [r.sessionQuestionId, r]));

  let firstUnsatisfiedIndex = -1;
  for (let i = 0; i < ordered.length; i++) {
    const q = ordered[i];
    const r = byId.get(q.id);
    if (!responseHasContent(r)) {
      firstUnsatisfiedIndex = i;
      break;
    }
  }

  const targetIndex = ordered.findIndex((q) => q.id === targetQuestionId);
  if (targetIndex < 0) {
    return;
  }

  if (firstUnsatisfiedIndex === -1) {
    return;
  }

  if (targetIndex === firstUnsatisfiedIndex || targetIndex < firstUnsatisfiedIndex) {
    return;
  }

  throw new SessionsServiceError(
    400,
    "Answer questions in order. Finish the current question before skipping ahead.",
    "SEQUENTIAL_ORDER",
  );
}

export function canViewSession(actor: AuthenticatedUser, session: { userId: string }): boolean {
  if (session.userId === actor.id) {
    return roleHasPermission(actor.role, "sessions:use");
  }
  return roleHasPermission(actor.role, "sessions:view_any");
}

function assertCanMutateOwnSession(actor: AuthenticatedUser, session: { userId: string }): void {
  if (session.userId !== actor.id) {
    throw new SessionsServiceError(403, "You can only modify your own sessions", "FORBIDDEN");
  }
  if (!roleHasPermission(actor.role, "sessions:use")) {
    throw new SessionsServiceError(403, "Missing permission: sessions:use", "FORBIDDEN");
  }
}

function assertCancelAllowed(from: SessionStatus): void {
  const allowed = new Set<SessionStatus>([
    SessionStatus.DRAFT,
    SessionStatus.GENERATING_QUESTIONS,
    SessionStatus.ACTIVE,
    SessionStatus.PAUSED,
  ]);
  if (!allowed.has(from)) {
    throw new SessionsServiceError(
      400,
      `Cannot cancel a session in status ${from}`,
      "VALIDATION_ERROR",
    );
  }
}

function responseHasContent(r: ResponseProgressInput | undefined): boolean {
  if (!r) return false;
  if (r.transcriptText?.trim() || r.finalAudioStorageKey?.trim()) return true;
  return (r.finalAudioDurationSec ?? 0) > 0;
}

export async function listTemplates() {
  return templateRepo.listPublishedTemplates();
}

export async function listSessions(actor: AuthenticatedUser, query: SessionListQuery) {
  const viewAny = roleHasPermission(actor.role, "sessions:view_any");

  if (!viewAny) {
    return sessionRepo.listSessionsForUser({
      userId: actor.id,
      take: query.take,
      status: query.status,
    });
  }

  if (query.userId) {
    return sessionRepo.listSessionsForPrivilegedUser({
      userId: query.userId,
      take: query.take,
      status: query.status,
    });
  }

  return sessionRepo.listSessionsForPrivileged({
    take: query.take,
    status: query.status,
  });
}

export async function getSessionByIdOrThrow(actor: AuthenticatedUser, sessionId: string) {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  if (!canViewSession(actor, session)) {
    throw new SessionsServiceError(403, "You cannot access this session", "FORBIDDEN");
  }
  return session;
}

export async function getSessionDetailWithProgress(actor: AuthenticatedUser, sessionId: string) {
  const session = await getSessionByIdOrThrow(actor, sessionId);
  const progress = computeSessionProgress({
    sessionQuestions: session.sessionQuestions ?? [],
    responses: session.responses ?? [],
  });
  return { session, progress };
}

export async function createSessionFromTemplate(actor: AuthenticatedUser, input: CreateSessionBody) {
  if (!roleHasPermission(actor.role, "sessions:use")) {
    throw new SessionsServiceError(403, "Missing permission: sessions:use", "FORBIDDEN");
  }

  const template = await templateRepo.getPublishedTemplateById(input.templateId);
  if (!template) {
    throw new SessionsServiceError(404, "Template not found", "NOT_FOUND");
  }

  const { id } = await sessionRepo.createTrainingSessionDraft({
    userId: actor.id,
    templateId: template.id,
    title: template.title,
  });

  const full = await sessionRepo.getSessionById(id);
  if (!full) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  return full;
}

export async function startSession(actor: AuthenticatedUser, sessionId: string) {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  assertCanMutateOwnSession(actor, session);
  if (session.status !== SessionStatus.DRAFT) {
    throw new SessionsServiceError(
      400,
      "Only draft sessions can be started",
      "VALIDATION_ERROR",
    );
  }
  if (!session.template) {
    throw new SessionsServiceError(400, "Session has no template", "VALIDATION_ERROR");
  }

  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new SessionsServiceError(
      503,
      "Question generation is not available right now. Try again later or contact support.",
      "SERVICE_UNAVAILABLE",
    );
  }

  const template = session.template;

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.GENERATING_QUESTIONS,
    lastActivityAt: new Date(),
  });

  try {
    const priorPrompts = await sessionRepo.fetchPriorPromptTextsForTemplateTopic({
      userId: actor.id,
      templateId: template.id,
      excludeSessionId: sessionId,
    });

    const { output, usage } = await runSessionQuestionGenerationModel({
      templateTitle: template.title,
      templateSlug: template.slug,
      sessionType: template.sessionType,
      templateDescription: template.description ?? null,
      priorPromptsSample: priorPrompts,
      questionCountMin: env.sessionGenerationMinQuestions,
      questionCountMax: env.sessionGenerationMaxQuestions,
    });

    const cost = estimateOpenAiMiniCostUsdFromUsage(
      usage.model,
      usage.promptTokens,
      usage.completionTokens,
    );

    await sessionRepo.createSessionQuestionsAndActivateSession({
      sessionId,
      templateSlug: template.slug,
      model: usage.model,
      questions: output.questions.map((q) => ({
        ordinal: q.ordinal,
        promptText: q.promptText,
        helpText: q.helpText ?? null,
        expectedDurationSec: q.expectedDurationSec ?? null,
        suggestedDurationSec: q.suggestedDurationSec ?? null,
        maxDurationSec: q.maxDurationSec ?? null,
      })),
    });

    await recordQuestionGenerationAiUsage({
      userId: actor.id,
      sessionId,
      model: usage.model,
      status: AiUsageLogStatus.SUCCESS,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: cost,
      requestMetaJson: {
        templateSlug: template.slug,
        priorPromptCount: priorPrompts.length,
        questionCountMin: env.sessionGenerationMinQuestions,
        questionCountMax: env.sessionGenerationMaxQuestions,
      },
      responseMetaJson: {
        questionCount: output.questions.length,
      },
    });

    return sessionRepo.getSessionById(sessionId);
  } catch (e) {
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.DRAFT,
      lastActivityAt: new Date(),
    });

    const msg = e instanceof Error ? e.message : "Question generation failed";
    await recordQuestionGenerationIncident({
      userId: actor.id,
      sessionId,
      errorMessage: msg,
      detailsJson: { name: e instanceof Error ? e.name : "Error" },
    });

    await recordQuestionGenerationAiUsage({
      userId: actor.id,
      sessionId,
      model: getQuestionsModelName(),
      status: AiUsageLogStatus.FAILED,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      requestMetaJson: { templateSlug: template.slug },
      responseMetaJson: { error: msg.slice(0, 500) },
    });

    throw new SessionsServiceError(
      502,
      msg,
      "QUESTION_GENERATION_FAILED",
    );
  }
}

export async function submitSessionResponse(
  actor: AuthenticatedUser,
  sessionId: string,
  input: SubmitSessionResponseBody,
) {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  assertCanMutateOwnSession(actor, session);

  if (session.status === SessionStatus.GENERATING_QUESTIONS) {
    throw new SessionsServiceError(
      400,
      "Questions are still being generated. Wait until the session is in progress.",
      "VALIDATION_ERROR",
    );
  }
  if (session.status !== SessionStatus.ACTIVE) {
    throw new SessionsServiceError(
      400,
      "You can only submit answers while the session is active",
      "VALIDATION_ERROR",
    );
  }

  const questions = session.sessionQuestions ?? [];
  if (questions.length === 0) {
    throw new SessionsServiceError(
      400,
      "No questions for this session yet. Start the session to generate questions.",
      "VALIDATION_ERROR",
    );
  }

  const question = questions.find((q) => q.id === input.sessionQuestionId);
  if (!question) {
    throw new SessionsServiceError(
      400,
      "Question does not belong to this session",
      "VALIDATION_ERROR",
    );
  }

  assertSequentialResponseAllowed(
    { questions },
    session.responses ?? [],
    question.id,
  );

  const existingForQuestion = (session.responses ?? []).find(
    (r) => r.sessionQuestionId === question.id,
  );
  if (
    existingForQuestion &&
    existingForQuestion.attemptCount >= existingForQuestion.maxAttempts
  ) {
    throw new SessionsServiceError(
      400,
      "No attempts remaining for this question.",
      "MAX_ATTEMPTS",
    );
  }

  const transcriptTrim =
    input.transcriptText !== undefined
      ? input.transcriptText?.trim() || null
      : (existingForQuestion?.transcriptText ?? null);
  const ts = transcriptTrim ? TranscriptStatus.AVAILABLE : TranscriptStatus.NONE;

  const storageKey =
    input.finalAudioStorageKey !== undefined
      ? input.finalAudioStorageKey?.trim() || null
      : (existingForQuestion?.finalAudioStorageKey ?? null);

  const durationSec =
    input.finalAudioDurationSec !== undefined
      ? input.finalAudioDurationSec
      : (existingForQuestion?.finalAudioDurationSec ?? null);

  const mimeType =
    input.finalAudioMimeType !== undefined
      ? input.finalAudioMimeType?.trim() || null
      : (existingForQuestion?.finalAudioMimeType ?? null);

  const bytes =
    input.finalAudioBytes !== undefined
      ? input.finalAudioBytes
      : (existingForQuestion?.finalAudioBytes ?? null);

  await sessionRepo.upsertSessionResponse({
    sessionId,
    sessionQuestionId: question.id,
    ordinal: question.ordinal,
    transcriptText: transcriptTrim,
    transcriptStatus: ts,
    finalAudioStorageKey: storageKey,
    finalAudioDurationSec: durationSec,
    finalAudioMimeType: mimeType,
    finalAudioBytes: bytes,
  });

  await sessionRepo.touchSessionActivity(sessionId);

  return sessionRepo.getSessionById(sessionId);
}

export async function completeSession(actor: AuthenticatedUser, sessionId: string) {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  assertCanMutateOwnSession(actor, session);
  if (session.status !== SessionStatus.ACTIVE) {
    throw new SessionsServiceError(
      400,
      "Only active sessions can be completed",
      "VALIDATION_ERROR",
    );
  }

  const questions = session.sessionQuestions ?? [];
  const required = questions.filter((q) => q.isRequired);
  const responses = session.responses ?? [];

  for (const q of required) {
    const r = resolveSessionResponseForQuestion(q, responses);
    if (!r) {
      throw new SessionsServiceError(
        400,
        `Answer all required questions before completing (missing question ${q.ordinal}).`,
        "VALIDATION_ERROR",
      );
    }
    if (!responseHasContent(r)) {
      throw new SessionsServiceError(
        400,
        `Question ${q.ordinal} needs a saved voice answer, transcript, or uploaded audio reference.`,
        "VALIDATION_ERROR",
      );
    }
  }

  const now = new Date();
  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.COMPLETED,
    lastActivityAt: now,
    endedAt: now,
    completedAt: now,
  });

  return sessionRepo.getSessionById(sessionId);
}

export async function cancelSession(actor: AuthenticatedUser, sessionId: string) {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  assertCanMutateOwnSession(actor, session);
  assertCancelAllowed(session.status);

  const now = new Date();
  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.CANCELLED,
    lastActivityAt: now,
    endedAt: now,
  });

  return sessionRepo.getSessionById(sessionId);
}
