import type { Prisma } from "@/generated/prisma/client";
import { AnalysisStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  ENRICHED_EVAL_RESULT_KIND,
  ENRICHED_EVAL_SCHEMA_VERSION,
} from "@/modules/openai/schemas/session-evaluation-output";

export const ANALYSIS_SCHEMA_VERSION = ENRICHED_EVAL_SCHEMA_VERSION;
export const ANALYSIS_RESULT_KIND = ENRICHED_EVAL_RESULT_KIND;

export async function findRunningAnalysisForSession(sessionId: string) {
  return prisma.sessionAnalysis.findFirst({
    where: { sessionId, status: AnalysisStatus.RUNNING },
  });
}

export async function createRunningAnalysis(sessionId: string) {
  return prisma.sessionAnalysis.create({
    data: {
      sessionId,
      status: AnalysisStatus.RUNNING,
      startedAt: new Date(),
      resultKind: ANALYSIS_RESULT_KIND,
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
    },
  });
}

export async function markAnalysisCompleted(
  id: string,
  data: {
    model: string;
    summary: string;
    payloadJson: Prisma.InputJsonValue;
  },
) {
  return prisma.sessionAnalysis.update({
    where: { id },
    data: {
      status: AnalysisStatus.COMPLETED,
      completedAt: new Date(),
      model: data.model,
      summary: data.summary,
      payloadJson: data.payloadJson,
      errorMessage: null,
    },
  });
}

export async function markAnalysisFailed(id: string, errorMessage: string) {
  return prisma.sessionAnalysis.update({
    where: { id },
    data: {
      status: AnalysisStatus.FAILED,
      completedAt: new Date(),
      errorMessage,
    },
  });
}

export async function findLatestAnalysisBySessionId(sessionId: string) {
  return prisma.sessionAnalysis.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}

/** One row per session id: latest analysis by createdAt (for dashboard next-action). */
export async function findLatestAnalysisBySessionIds(sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, { id: string; status: AnalysisStatus }>();
  }
  const rows = await prisma.sessionAnalysis.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true, sessionId: true, status: true },
  });
  const map = new Map<string, { id: string; status: AnalysisStatus }>();
  for (const r of rows) {
    if (!map.has(r.sessionId)) {
      map.set(r.sessionId, { id: r.id, status: r.status });
    }
  }
  return map;
}

export const analysisListItemSelect = {
  id: true,
  sessionId: true,
  status: true,
  summary: true,
  completedAt: true,
  createdAt: true,
  session: {
    select: {
      id: true,
      title: true,
      userId: true,
      template: { select: { title: true, slug: true } },
    },
  },
} satisfies Prisma.SessionAnalysisSelect;

export async function listAnalysesForUser(params: { userId: string; take: number; status?: AnalysisStatus }) {
  return prisma.sessionAnalysis.findMany({
    where: {
      session: { userId: params.userId },
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.take,
    select: analysisListItemSelect,
  });
}

export async function listAnalysesForPrivileged(params: {
  take: number;
  status?: AnalysisStatus;
  filterUserId?: string;
}) {
  return prisma.sessionAnalysis.findMany({
    where: {
      ...(params.filterUserId ? { session: { userId: params.filterUserId } } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.take,
    select: analysisListItemSelect,
  });
}

export async function findAnalysisByIdWithSession(analysisId: string) {
  return prisma.sessionAnalysis.findUnique({
    where: { id: analysisId },
    include: {
      session: {
        select: {
          id: true,
          userId: true,
          title: true,
          finalizationMetaJson: true,
          template: { select: { id: true, title: true, slug: true, sessionType: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });
}

export async function countCompletedAnalysesForUser(userId: string) {
  return prisma.sessionAnalysis.count({
    where: {
      status: AnalysisStatus.COMPLETED,
      session: { userId },
    },
  });
}

export async function findCompletedAnalysesForUserMetrics(userId: string, take: number) {
  return prisma.sessionAnalysis.findMany({
    where: {
      status: AnalysisStatus.COMPLETED,
      session: { userId },
    },
    orderBy: { completedAt: "desc" },
    take,
    select: {
      id: true,
      sessionId: true,
      completedAt: true,
      payloadJson: true,
      session: { select: { id: true, title: true } },
    },
  });
}
