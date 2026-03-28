import {
  AiUsageLogStatus,
  AnalysisStatus,
  SessionStatus,
  SessionType,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getServerEnv } from "@/lib/config/env";
import { estimateOpenAiMiniCostUsdFromUsage, runSessionEvaluationModel } from "@/modules/openai";
import {
  ANALYSIS_RESULT_KIND,
  ANALYSIS_SCHEMA_VERSION,
} from "@/modules/analyses/infrastructure/session-analysis-repository";
import * as analysisRepo from "@/modules/analyses/infrastructure/session-analysis-repository";
import { recordSessionEvaluationAiUsage } from "@/modules/analyses/infrastructure/evaluation-ai-usage-logging";
import { recordProgressAfterSuccessfulAnalysis } from "@/modules/analyses/application/progress-service";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import { getSessionByIdOrThrow } from "@/modules/sessions/application/session-service";
import { responseRowReadyForEnrichedEvaluation } from "@/modules/sessions/domain/transcript-readiness";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";

function assertOwnerForEvaluation(actor: AuthenticatedUser, session: { userId: string }): void {
  if (session.userId !== actor.id) {
    throw new AnalysisServiceError(403, "You can only request analysis for your own sessions", "FORBIDDEN");
  }
}

function readTranscriptFallbackOrdinals(meta: unknown): number[] {
  if (!meta || typeof meta !== "object") return [];
  const o = meta as Record<string, unknown>;
  const arr = o.transcriptFallbackOrdinals;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is number => typeof x === "number");
}

/** Whether the synchronous OpenAI + parse pipeline produced a COMPLETED row (vs FAILED). */
export type SessionEvaluationRunOutcome = "SUCCEEDED" | "FAILED";

export type EvaluateCompletedSessionResult = {
  analysis: NonNullable<Awaited<ReturnType<typeof analysisRepo.findLatestAnalysisBySessionId>>>;
  evaluationRun: {
    outcome: SessionEvaluationRunOutcome;
    message: string | null;
  };
};

/**
 * Runs AI evaluation. Allowed when session is **COMPLETED** (legacy manual) or **ANALYZING** (automatic finalize pipeline).
 * When **ANALYZING**, transitions session to **COMPLETED** after the run (success or failure).
 */
export async function evaluateCompletedSession(
  actor: AuthenticatedUser,
  sessionId: string,
): Promise<EvaluateCompletedSessionResult> {
  const session = await getSessionByIdOrThrow(actor, sessionId);
  assertOwnerForEvaluation(actor, session);

  if (
    session.status !== SessionStatus.COMPLETED &&
    session.status !== SessionStatus.ANALYZING
  ) {
    throw new AnalysisServiceError(
      400,
      "Analysis is not available for this session state",
      "VALIDATION_ERROR",
    );
  }

  const wasAnalyzing = session.status === SessionStatus.ANALYZING;

  const markSessionCompletedIfNeeded = async () => {
    if (!wasAnalyzing) return;
    const end = new Date();
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.COMPLETED,
      lastActivityAt: end,
      endedAt: end,
      completedAt: end,
    });
  };

  const running = await analysisRepo.findRunningAnalysisForSession(sessionId);
  if (running) {
    throw new AnalysisServiceError(409, "An analysis is already running for this session", "CONFLICT");
  }

  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    await markSessionCompletedIfNeeded();
    throw new AnalysisServiceError(
      503,
      "Scoring is not available right now. Your answers are saved—try again shortly, or use “Run evaluation again” on this session page.",
      "SERVICE_UNAVAILABLE",
    );
  }

  const responses = session.responses ?? [];
  if (responses.length === 0) {
    throw new AnalysisServiceError(
      400,
      "Session has no recorded answers to evaluate",
      "VALIDATION_ERROR",
    );
  }

  const questions = session.sessionQuestions ?? [];
  const requiredQs = questions.filter((q) => q.isRequired);
  const respByQ = new Map(responses.map((r) => [r.sessionQuestionId, r]));
  for (const q of requiredQs) {
    const r = respByQ.get(q.id);
    if (!r || !responseRowReadyForEnrichedEvaluation(r)) {
      throw new AnalysisServiceError(
        422,
        "Scoring needs transcripts for each answer. If preparation failed, use “Try preparing again” on the session page.",
        "TRANSCRIPTS_NOT_READY",
      );
    }
  }

  const byQid = new Map(questions.map((q) => [q.id, q]));
  const items = responses
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((r) => {
      const q = byQid.get(r.sessionQuestionId);
      const storageKey = r.finalAudioStorageKey?.trim();
      return {
        ordinal: r.ordinal,
        promptText: q?.promptText ?? "(Missing question text)",
        transcriptText: r.transcriptText,
        audioUrl: storageKey ? `[storage:${storageKey}]` : null,
        durationSec: r.finalAudioDurationSec ?? null,
      };
    });

  const record = await analysisRepo.createRunningAnalysis(sessionId);
  const modelName = env.OPENAI_EVAL_MODEL;

  try {
    const transcriptFallbackOrdinals = readTranscriptFallbackOrdinals(session.finalizationMetaJson);

    const { rawText, evaluation, usage } = await runSessionEvaluationModel({
      sessionTitle: session.title,
      templateTitle: session.template?.title ?? null,
      sessionType: session.template?.sessionType ?? SessionType.GUIDED_DIALOGUE,
      items,
      transcriptFallbackOrdinals,
    });

    const payloadJson: Prisma.InputJsonValue = {
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
      resultKind: ANALYSIS_RESULT_KIND,
      rawModelOutput: rawText,
      evaluation: evaluation as unknown as Prisma.InputJsonValue,
    };

    await analysisRepo.markAnalysisCompleted(record.id, {
      model: modelName,
      summary: evaluation.sessionSummary,
      payloadJson,
    });

    const cost = estimateOpenAiMiniCostUsdFromUsage(modelName, usage.promptTokens, usage.completionTokens);

    await recordSessionEvaluationAiUsage({
      userId: session.userId,
      sessionId,
      analysisId: record.id,
      model: modelName,
      status: AiUsageLogStatus.SUCCESS,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: cost,
      requestMetaJson: { sessionId, analysisId: record.id },
      responseMetaJson: { outcome: "completed" },
    });

    try {
      await recordProgressAfterSuccessfulAnalysis({
        userId: session.userId,
        sessionId,
        analysisId: record.id,
        evaluation,
      });
    } catch (progressErr) {
      console.error("[analyses] progress snapshot failed:", progressErr);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Evaluation failed";
    await analysisRepo.markAnalysisFailed(record.id, msg);

    await recordSessionEvaluationAiUsage({
      userId: session.userId,
      sessionId,
      analysisId: record.id,
      model: modelName,
      status: AiUsageLogStatus.FAILED,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      requestMetaJson: { sessionId, analysisId: record.id },
      responseMetaJson: { error: msg.slice(0, 500) },
    });
  } finally {
    await markSessionCompletedIfNeeded();
  }

  const latest = await analysisRepo.findLatestAnalysisBySessionId(sessionId);
  if (!latest) {
    throw new AnalysisServiceError(500, "Could not load analysis record");
  }

  const succeeded = latest.status === AnalysisStatus.COMPLETED;
  return {
    analysis: latest,
    evaluationRun: {
      outcome: succeeded ? "SUCCEEDED" : "FAILED",
      message: succeeded ? null : latest.errorMessage,
    },
  };
}

export async function getLatestAnalysisForSession(actor: AuthenticatedUser, sessionId: string) {
  await getSessionByIdOrThrow(actor, sessionId);
  return analysisRepo.findLatestAnalysisBySessionId(sessionId);
}
