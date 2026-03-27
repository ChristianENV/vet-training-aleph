import type { Prisma } from "@/generated/prisma/client";
import type { SessionEvaluationOutput } from "@/modules/openai/schemas/session-evaluation-output";
import * as analysisRepo from "@/modules/analyses/infrastructure/session-analysis-repository";
import * as progressRepo from "@/modules/analyses/infrastructure/progress-repository";

const METRICS_VERSION = 1 as const;

function overallScoreFromPayload(payloadJson: unknown): number | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const ev = (payloadJson as Record<string, unknown>).evaluation;
  if (!ev || typeof ev !== "object") return null;
  const s = (ev as Record<string, unknown>).overallScore;
  return typeof s === "number" ? s : null;
}

export type ProgressMetricsV1 = {
  version: typeof METRICS_VERSION;
  totalCompletedAnalyses: number;
  averageOverallScore: number;
  lastOverallScore: number;
  lastAnalysisId: string;
  lastSessionId: string;
  lastSessionTitle: string | null;
  recentOverallScores: number[];
};

/**
 * Called after a SessionAnalysis is marked COMPLETED with a valid evaluation payload.
 * Failures are non-fatal for the evaluation request (caller should catch/log).
 */
export async function recordProgressAfterSuccessfulAnalysis(input: {
  userId: string;
  sessionId: string;
  analysisId: string;
  evaluation: SessionEvaluationOutput;
}): Promise<void> {
  const rows = await analysisRepo.findCompletedAnalysesForUserMetrics(input.userId, 200);
  const scores = rows
    .map((r) => overallScoreFromPayload(r.payloadJson))
    .filter((n): n is number => n !== null);

  const total = await analysisRepo.countCompletedAnalysesForUser(input.userId);
  const averageOverallScore =
    scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : input.evaluation.overallScore;

  const recentOverallScores = rows
    .slice(0, 5)
    .map((r) => overallScoreFromPayload(r.payloadJson))
    .filter((n): n is number => n !== null);

  const lastRow = rows[0];
  const lastSessionTitle = lastRow?.session?.title ?? null;

  const metrics: ProgressMetricsV1 = {
    version: METRICS_VERSION,
    totalCompletedAnalyses: total,
    averageOverallScore,
    lastOverallScore: input.evaluation.overallScore,
    lastAnalysisId: input.analysisId,
    lastSessionId: input.sessionId,
    lastSessionTitle,
    recentOverallScores,
  };

  await progressRepo.createProgressSnapshot({
    userId: input.userId,
    readiness: input.evaluation.readinessLevel,
    sessionId: input.sessionId,
    metricsJson: metrics as unknown as Prisma.InputJsonValue,
  });
}
