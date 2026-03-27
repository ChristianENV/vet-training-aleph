import type { Prisma } from "@/generated/prisma/client";
import { InputMode, SessionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export const templateQuestionPublicSelect = {
  id: true,
  ordinal: true,
  promptText: true,
  helpText: true,
  expectedDurationSec: true,
  isRequired: true,
} satisfies Prisma.SessionTemplateQuestionSelect;

export const sessionResponsePublicSelect = {
  id: true,
  templateQuestionId: true,
  ordinal: true,
  audioUrl: true,
  transcriptText: true,
  durationSec: true,
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
  template: {
    select: {
      id: true,
      slug: true,
      title: true,
      sessionType: true,
      description: true,
      questions: {
        orderBy: { ordinal: "asc" },
        select: templateQuestionPublicSelect,
      },
    },
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

export async function upsertSessionResponse(input: {
  sessionId: string;
  templateQuestionId: string;
  ordinal: number;
  audioUrl: string | null;
  transcriptText: string | null;
  durationSec: number | null;
}) {
  return prisma.sessionResponse.upsert({
    where: {
      sessionId_templateQuestionId: {
        sessionId: input.sessionId,
        templateQuestionId: input.templateQuestionId,
      },
    },
    create: {
      sessionId: input.sessionId,
      templateQuestionId: input.templateQuestionId,
      ordinal: input.ordinal,
      audioUrl: input.audioUrl,
      transcriptText: input.transcriptText,
      durationSec: input.durationSec,
      answeredAt: new Date(),
    },
    update: {
      ordinal: input.ordinal,
      audioUrl: input.audioUrl,
      transcriptText: input.transcriptText,
      durationSec: input.durationSec,
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
