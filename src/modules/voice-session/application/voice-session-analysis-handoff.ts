import { AiUsageLogStatus, AnalysisStatus, SessionStatus, SessionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getServerEnv } from "@/lib/config/env";
import { estimateOpenAiMiniCostUsdFromUsage, runSessionEvaluationModel } from "@/modules/openai";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import * as analysisRepo from "@/modules/analyses/infrastructure/session-analysis-repository";
import { recordSessionEvaluationAiUsage } from "@/modules/analyses/infrastructure/evaluation-ai-usage-logging";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";
import { buildAnalysisItemsFromVoiceTurns } from "./voice-transcript-analysis-adapter";

export async function triggerVoiceSessionAnalysis(actor: AuthenticatedUser, sessionId: string) {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new AnalysisServiceError(503, "Scoring is not available right now.", "SERVICE_UNAVAILABLE");
  }

  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new AnalysisServiceError(404, "Session not found", "NOT_FOUND");
  }
  if (session.userId !== actor.id) {
    throw new AnalysisServiceError(403, "You can only evaluate your own sessions", "FORBIDDEN");
  }

  const existingRunning = await analysisRepo.findRunningAnalysisForSession(sessionId);
  if (existingRunning) {
    return {
      analysis: existingRunning,
      evaluationRun: {
        outcome: "FAILED" as const,
        message: "Analysis already in progress",
      },
      skipped: true as const,
    };
  }
  const existingLatest = await analysisRepo.findLatestAnalysisBySessionId(sessionId);
  if (existingLatest?.status === AnalysisStatus.COMPLETED) {
    return {
      analysis: existingLatest,
      evaluationRun: {
        outcome: "SUCCEEDED" as const,
        message: null,
      },
      skipped: true as const,
    };
  }

  const turns = await sessionRepo.listSessionTurns(sessionId, 300);
  const items = buildAnalysisItemsFromVoiceTurns(
    turns
      .filter((t) => t.isFinal)
      .map((t) => ({
        id: t.id,
        speaker: t.speaker as "assistant" | "user" | "system",
        text: t.text,
        createdAt: t.createdAt.toISOString(),
        sequence: t.sequence,
        isFinal: t.isFinal,
      })),
  );

  if (items.length === 0) {
    throw new AnalysisServiceError(
      422,
      "No finalized conversational turns available for scoring.",
      "VALIDATION_ERROR",
    );
  }

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.ANALYZING,
    lastActivityAt: new Date(),
  });

  const running = await analysisRepo.createRunningAnalysis(sessionId);
  try {
    const { rawText, evaluation, usage } = await runSessionEvaluationModel({
      sessionTitle: session.title ?? "Voice session",
      templateTitle: session.template?.title ?? null,
      sessionType: session.template?.sessionType ?? SessionType.GUIDED_DIALOGUE,
      items: items.map((it) => ({
        ordinal: it.ordinal,
        promptText: it.promptText,
        transcriptText: it.transcriptText,
        audioUrl: null,
        durationSec: null,
      })),
      transcriptFallbackOrdinals: [],
    });

    const payloadJson: Prisma.InputJsonValue = {
      schemaVersion: analysisRepo.ANALYSIS_SCHEMA_VERSION,
      resultKind: analysisRepo.ANALYSIS_RESULT_KIND,
      rawModelOutput: rawText,
      evaluation: evaluation as unknown as Prisma.InputJsonValue,
      source: "voice-turns",
    };
    await analysisRepo.markAnalysisCompleted(running.id, {
      model: env.OPENAI_EVAL_MODEL,
      summary: evaluation.sessionSummary,
      payloadJson,
    });

    const cost = estimateOpenAiMiniCostUsdFromUsage(
      env.OPENAI_EVAL_MODEL,
      usage.promptTokens,
      usage.completionTokens,
    );
    await recordSessionEvaluationAiUsage({
      userId: actor.id,
      sessionId,
      analysisId: running.id,
      model: env.OPENAI_EVAL_MODEL,
      status: AiUsageLogStatus.SUCCESS,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: cost,
      requestMetaJson: { source: "voice-turns", itemCount: items.length },
      responseMetaJson: { outcome: "completed" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Voice session evaluation failed";
    await analysisRepo.markAnalysisFailed(running.id, msg);
    await recordSessionEvaluationAiUsage({
      userId: actor.id,
      sessionId,
      analysisId: running.id,
      model: env.OPENAI_EVAL_MODEL,
      status: AiUsageLogStatus.FAILED,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      requestMetaJson: { source: "voice-turns", itemCount: items.length },
      responseMetaJson: { error: msg.slice(0, 400) },
    });
  } finally {
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.COMPLETED,
      lastActivityAt: new Date(),
      endedAt: new Date(),
      completedAt: new Date(),
    });
  }

  const latest = await analysisRepo.findLatestAnalysisBySessionId(sessionId);
  if (!latest) {
    throw new AnalysisServiceError(500, "Analysis record not found");
  }

  return {
    analysis: latest,
    evaluationRun: {
      outcome: latest.status === AnalysisStatus.COMPLETED ? ("SUCCEEDED" as const) : ("FAILED" as const),
      message: latest.status === AnalysisStatus.COMPLETED ? null : latest.errorMessage,
    },
  };
}

