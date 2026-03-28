import { SessionStatus } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { roleHasPermission } from "@/lib/auth/permissions";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";
import * as templateRepo from "@/modules/sessions/infrastructure/session-template-repository";
import type {
  CreateSessionBody,
  SessionListQuery,
  SubmitSessionResponseBody,
} from "@/modules/sessions/validators/sessions";

export class SessionsServiceError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SessionsServiceError";
  }
}

export type SessionProgressSnapshot = {
  totalQuestions: number;
  /** Questions that have a non-empty transcript or audio reference (ordered, strict flow). */
  answeredCount: number;
  /** First question (by template ordinal) that does not yet have a satisfactory answer; null when all are filled. */
  currentQuestionId: string | null;
  completionPercent: number;
};

type QuestionProgressInput = { id: string; ordinal: number; isRequired: boolean };
type ResponseProgressInput = {
  templateQuestionId: string;
  transcriptText: string | null;
  audioUrl: string | null;
};

/**
 * MVP rule: learners answer template questions in **strict ordinal order**.
 * Progress "answered" = row exists with non-empty transcript or audio (same bar as completion).
 * Current question = first ordinal still missing that content.
 */
export function computeSessionProgress(session: {
  template: {
    questions: QuestionProgressInput[];
  } | null;
  responses: ResponseProgressInput[];
}): SessionProgressSnapshot {
  const ordered = [...(session.template?.questions ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const total = ordered.length;
  const byId = new Map(session.responses.map((r) => [r.templateQuestionId, r]));

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

/**
 * Enforces strict sequential answering + simple edit policy:
 * - May answer only the **current** (first unsatisfied) question, OR re-submit to any **earlier** ordinal (edit past answers).
 * - When every question is satisfied, may edit any question (review before complete).
 */
function assertSequentialResponseAllowed(
  template: { questions: QuestionProgressInput[] },
  responses: ResponseProgressInput[],
  targetQuestionId: string,
): void {
  const ordered = [...template.questions].sort((a, b) => a.ordinal - b.ordinal);
  const byId = new Map(responses.map((r) => [r.templateQuestionId, r]));

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

function assertTransition(from: SessionStatus, to: SessionStatus): void {
  const allowed: Partial<Record<SessionStatus, SessionStatus[]>> = {
    [SessionStatus.DRAFT]: [SessionStatus.ACTIVE, SessionStatus.CANCELLED],
    [SessionStatus.ACTIVE]: [SessionStatus.COMPLETED, SessionStatus.CANCELLED],
    [SessionStatus.PAUSED]: [SessionStatus.ACTIVE, SessionStatus.COMPLETED, SessionStatus.CANCELLED],
  };
  const ok = allowed[from]?.includes(to) ?? false;
  if (!ok) {
    throw new SessionsServiceError(
      400,
      `Invalid status transition: ${from} → ${to}`,
      "VALIDATION_ERROR",
    );
  }
}

function responseHasContent(r: {
  transcriptText: string | null;
  audioUrl: string | null;
} | undefined): boolean {
  if (!r) return false;
  return Boolean(r.transcriptText?.trim() || r.audioUrl?.trim());
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
  const progress = computeSessionProgress(session);
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
  if (!template.questions.length) {
    throw new SessionsServiceError(400, "Template has no questions configured", "VALIDATION_ERROR");
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

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.ACTIVE,
    lastActivityAt: new Date(),
  });

  return sessionRepo.getSessionById(sessionId);
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

  if (session.status !== SessionStatus.ACTIVE) {
    throw new SessionsServiceError(
      400,
      "You can only submit answers while the session is active",
      "VALIDATION_ERROR",
    );
  }

  const template = session.template;
  if (!template) {
    throw new SessionsServiceError(400, "Session has no template", "VALIDATION_ERROR");
  }

  const question = template.questions.find((q) => q.id === input.templateQuestionId);
  if (!question) {
    throw new SessionsServiceError(
      400,
      "Question does not belong to this session template",
      "VALIDATION_ERROR",
    );
  }

  assertSequentialResponseAllowed(template, session.responses ?? [], question.id);

  await sessionRepo.upsertSessionResponse({
    sessionId,
    templateQuestionId: question.id,
    ordinal: question.ordinal,
    audioUrl: input.audioUrl?.trim() || null,
    transcriptText: input.transcriptText?.trim() || null,
    durationSec: input.durationSec ?? null,
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

  const questions = session.template?.questions ?? [];
  const required = questions.filter((q) => q.isRequired);
  const responses = session.responses ?? [];
  const byQ = new Map(responses.map((r) => [r.templateQuestionId, r]));

  for (const q of required) {
    const r = byQ.get(q.id);
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
        `Question ${q.ordinal} needs a transcript or audio reference.`,
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
  assertTransition(session.status, SessionStatus.CANCELLED);

  const now = new Date();
  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.CANCELLED,
    lastActivityAt: now,
    endedAt: now,
  });

  return sessionRepo.getSessionById(sessionId);
}
