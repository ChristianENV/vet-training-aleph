import type { Prisma } from "@/generated/prisma/client";
import { InputMode, SessionStatus, TranscriptStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

const PRIOR_SESSIONS_FOR_TOPIC = 8;
const MAX_PRIOR_PROMPTS = 24;

export const sessionQuestionPublicSelect = {
  id: true,
  ordinal: true,
  promptText: true,
  helpText: true,
  expectedDurationSec: true,
  suggestedDurationSec: true,
  maxDurationSec: true,
  isRequired: true,
  generatedByModel: true,
  sourceTopic: true,
} satisfies Prisma.SessionQuestionSelect;

export const sessionResponsePublicSelect = {
  id: true,
  sessionQuestionId: true,
  ordinal: true,
  transcriptText: true,
  transcriptStatus: true,
  transcriptProvider: true,
  attemptCount: true,
  maxAttempts: true,
  finalAudioStorageKey: true,
  finalAudioProvider: true,
  finalAudioMimeType: true,
  finalAudioBytes: true,
  finalAudioDurationSec: true,
  finalAudioCodec: true,
  audioUploadedAt: true,
  answeredAt: true,
} satisfies Prisma.SessionResponseSelect;

export const sessionListSelect = {
  id: true,
  userId: true,
  templateId: true,
  status: true,
  inputMode: true,
  title: true,
  locale: true,
  startedAt: true,
  endedAt: true,
  completedAt: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
  template: {
    select: { id: true, slug: true, title: true, sessionType: true },
  },
} satisfies Prisma.TrainingSessionSelect;

export const sessionDetailSelect = {
  ...sessionListSelect,
  finalizationMetaJson: true,
  template: {
    select: {
      id: true,
      slug: true,
      title: true,
      sessionType: true,
      description: true,
    },
  },
  sessionQuestions: {
    orderBy: { ordinal: "asc" },
    select: sessionQuestionPublicSelect,
  },
  responses: {
    orderBy: { ordinal: "asc" },
    select: sessionResponsePublicSelect,
  },
} satisfies Prisma.TrainingSessionSelect;

export async function createTrainingSessionDraft(input: {
  userId: string;
  templateId: string;
  title: string;
}): Promise<{ id: string }> {
  return prisma.trainingSession.create({
    data: {
      userId: input.userId,
      templateId: input.templateId,
      status: SessionStatus.DRAFT,
      title: input.title,
      inputMode: InputMode.VOICE,
      lastActivityAt: new Date(),
    },
    select: { id: true },
  });
}

export async function getSessionById(sessionId: string) {
  return prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: sessionDetailSelect,
  });
}

export async function listSessionsForUser(params: {
  userId: string;
  take: number;
  status?: SessionStatus;
}) {
  return prisma.trainingSession.findMany({
    where: {
      userId: params.userId,
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.take,
    select: sessionListSelect,
  });
}

export async function listSessionsForPrivileged(params: { take: number; status?: SessionStatus }) {
  return prisma.trainingSession.findMany({
    where: params.status ? { status: params.status } : {},
    orderBy: { updatedAt: "desc" },
    take: params.take,
    select: sessionListSelect,
  });
}

export async function listSessionsForPrivilegedUser(params: {
  userId: string;
  take: number;
  status?: SessionStatus;
}) {
  return prisma.trainingSession.findMany({
    where: {
      userId: params.userId,
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: params.take,
    select: sessionListSelect,
  });
}

export async function touchSessionActivity(sessionId: string) {
  return prisma.trainingSession.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() },
  });
}

export async function updateTrainingSessionFinalizationMeta(
  sessionId: string,
  meta: Prisma.InputJsonValue,
) {
  return prisma.trainingSession.update({
    where: { id: sessionId },
    data: { finalizationMetaJson: meta },
  });
}

export async function mergeSessionFinalizationMeta(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const row = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { finalizationMetaJson: true },
  });
  const prev =
    row?.finalizationMetaJson &&
    typeof row.finalizationMetaJson === "object" &&
    !Array.isArray(row.finalizationMetaJson)
      ? { ...(row.finalizationMetaJson as Record<string, unknown>) }
      : {};
  const next = { ...prev, ...patch };
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { finalizationMetaJson: next as Prisma.InputJsonValue },
  });
}

export async function updateSessionResponseTranscriptResult(input: {
  sessionId: string;
  sessionQuestionId: string;
  transcriptText: string;
  transcriptStatus: TranscriptStatus;
  transcriptProvider: string;
}) {
  return prisma.sessionResponse.update({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: input.sessionId,
        sessionQuestionId: input.sessionQuestionId,
      },
    },
    data: {
      transcriptText: input.transcriptText,
      transcriptStatus: input.transcriptStatus,
      transcriptProvider: input.transcriptProvider,
    },
    select: sessionResponsePublicSelect,
  });
}

export async function updateSessionResponseTranscriptFailure(input: {
  sessionId: string;
  sessionQuestionId: string;
}) {
  return prisma.sessionResponse.update({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: input.sessionId,
        sessionQuestionId: input.sessionQuestionId,
      },
    },
    data: {
      transcriptStatus: TranscriptStatus.FAILED,
      transcriptProvider: "openai",
    },
    select: sessionResponsePublicSelect,
  });
}

export async function markSupportFieldTranscriptReady(input: {
  sessionId: string;
  sessionQuestionId: string;
}) {
  return prisma.sessionResponse.update({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: input.sessionId,
        sessionQuestionId: input.sessionQuestionId,
      },
    },
    data: {
      transcriptStatus: TranscriptStatus.AVAILABLE,
      transcriptProvider: "support_field",
    },
    select: sessionResponsePublicSelect,
  });
}

export async function updateSessionResponseFinalAudio(input: {
  sessionId: string;
  sessionQuestionId: string;
  finalAudioStorageKey: string;
  finalAudioProvider: string;
  finalAudioMimeType: string | null;
  finalAudioBytes: number | null;
}) {
  return prisma.sessionResponse.update({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: input.sessionId,
        sessionQuestionId: input.sessionQuestionId,
      },
    },
    data: {
      finalAudioStorageKey: input.finalAudioStorageKey,
      finalAudioProvider: input.finalAudioProvider,
      finalAudioMimeType: input.finalAudioMimeType,
      finalAudioBytes: input.finalAudioBytes,
      audioUploadedAt: new Date(),
    },
    select: sessionResponsePublicSelect,
  });
}

export async function upsertSessionResponse(input: {
  sessionId: string;
  sessionQuestionId: string;
  ordinal: number;
  transcriptText: string | null;
  transcriptStatus?: Prisma.SessionResponseCreateInput["transcriptStatus"];
  finalAudioStorageKey: string | null;
  finalAudioDurationSec: number | null;
  finalAudioMimeType?: string | null;
  finalAudioBytes?: number | null;
}) {
  return prisma.sessionResponse.upsert({
    where: {
      sessionId_sessionQuestionId: {
        sessionId: input.sessionId,
        sessionQuestionId: input.sessionQuestionId,
      },
    },
    create: {
      sessionId: input.sessionId,
      sessionQuestionId: input.sessionQuestionId,
      ordinal: input.ordinal,
      transcriptText: input.transcriptText,
      transcriptStatus: input.transcriptStatus,
      finalAudioStorageKey: input.finalAudioStorageKey,
      finalAudioDurationSec: input.finalAudioDurationSec,
      finalAudioMimeType: input.finalAudioMimeType ?? null,
      finalAudioBytes: input.finalAudioBytes ?? null,
      attemptCount: 1,
      answeredAt: new Date(),
    },
    update: {
      ordinal: input.ordinal,
      transcriptText: input.transcriptText,
      transcriptStatus: input.transcriptStatus,
      finalAudioStorageKey: input.finalAudioStorageKey,
      finalAudioDurationSec: input.finalAudioDurationSec,
      finalAudioMimeType: input.finalAudioMimeType ?? null,
      finalAudioBytes: input.finalAudioBytes ?? null,
      attemptCount: { increment: 1 },
      answeredAt: new Date(),
    },
    select: sessionResponsePublicSelect,
  });
}

export async function updateSessionStatus(input: {
  sessionId: string;
  status: SessionStatus;
  lastActivityAt?: Date;
  endedAt?: Date;
  completedAt?: Date;
}) {
  return prisma.trainingSession.update({
    where: { id: input.sessionId },
    data: {
      status: input.status,
      ...(input.lastActivityAt !== undefined ? { lastActivityAt: input.lastActivityAt } : {}),
      ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
    },
    select: sessionListSelect,
  });
}

/**
 * Prior completed/archived sessions for the same template, then a bounded deduped list of prompt texts
 * to steer GPT away from repeating past prompts.
 */
export async function fetchPriorPromptTextsForTemplateTopic(params: {
  userId: string;
  templateId: string;
  excludeSessionId: string;
}): Promise<string[]> {
  const recentSessions = await prisma.trainingSession.findMany({
    where: {
      userId: params.userId,
      templateId: params.templateId,
      id: { not: params.excludeSessionId },
      status: {
        in: [SessionStatus.COMPLETED, SessionStatus.CANCELLED, SessionStatus.ARCHIVED],
      },
    },
    orderBy: { createdAt: "desc" },
    take: PRIOR_SESSIONS_FOR_TOPIC,
    select: { id: true },
  });

  const prompts: string[] = [];
  const seen = new Set<string>();
  for (const row of recentSessions) {
    const qs = await prisma.sessionQuestion.findMany({
      where: { sessionId: row.id },
      orderBy: { ordinal: "asc" },
      select: { promptText: true },
    });
    for (const q of qs) {
      const t = q.promptText.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      prompts.push(t);
      if (prompts.length >= MAX_PRIOR_PROMPTS) return prompts;
    }
  }
  return prompts;
}

/**
 * Persists generated questions and moves the session to ACTIVE in one transaction
 * so we never leave orphan questions without an active session.
 */
export async function createSessionQuestionsAndActivateSession(input: {
  sessionId: string;
  templateSlug: string;
  model: string;
  questions: Array<{
    ordinal: number;
    promptText: string;
    helpText: string | null;
    expectedDurationSec: number | null;
    suggestedDurationSec: number | null;
    maxDurationSec: number | null;
  }>;
}): Promise<void> {
  if (input.questions.length === 0) {
    throw new Error("Question generation produced no questions");
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.sessionQuestion.createMany({
      data: input.questions.map((q) => ({
        sessionId: input.sessionId,
        ordinal: q.ordinal,
        promptText: q.promptText,
        helpText: q.helpText,
        expectedDurationSec: q.expectedDurationSec,
        suggestedDurationSec: q.suggestedDurationSec,
        maxDurationSec: q.maxDurationSec,
        isRequired: true,
        generatedByModel: input.model,
        sourceTopic: input.templateSlug,
      })),
    });
    await tx.trainingSession.update({
      where: { id: input.sessionId },
      data: {
        status: SessionStatus.ACTIVE,
        lastActivityAt: now,
      },
    });
  });
}
