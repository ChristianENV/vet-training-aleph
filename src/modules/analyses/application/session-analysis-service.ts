import { AnalysisStatus, SessionStatus, SessionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getServerEnv } from "@/lib/config/env";
import { runSessionEvaluationModel } from "@/modules/openai";
import {
  ANALYSIS_RESULT_KIND,
  ANALYSIS_SCHEMA_VERSION,
} from "@/modules/analyses/infrastructure/session-analysis-repository";
import * as analysisRepo from "@/modules/analyses/infrastructure/session-analysis-repository";
import { recordProgressAfterSuccessfulAnalysis } from "@/modules/analyses/application/progress-service";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import { getSessionByIdOrThrow } from "@/modules/sessions/application/session-service";

function assertOwnerForEvaluation(actor: AuthenticatedUser, session: { userId: string }): void {
  if (session.userId !== actor.id) {
    throw new AnalysisServiceError(403, "You can only request analysis for your own sessions", "FORBIDDEN");
  }
}

/** Whether the synchronous OpenAI + parse pipeline produced a COMPLETED row (vs FAILED). */
export type SessionEvaluationRunOutcome = "SUCCEEDED" | "FAILED";

export type EvaluateCompletedSessionResult = {
  analysis: NonNullable<Awaited<ReturnType<typeof analysisRepo.findLatestAnalysisBySessionId>>>;
  /**
   * Explicit run outcome — do not infer success from HTTP 200 alone.
   * When FAILED, `analysis.status` is FAILED and `evaluationRun.message` matches persisted `errorMessage`.
   */
  evaluationRun: {
    outcome: SessionEvaluationRunOutcome;
    message: string | null;
  };
};

/**
 * Runs AI evaluation for a completed session. Caller must enforce `analyses:request` + session access (see POST route).
 * Always returns 200 from the route when this resolves; check `evaluationRun.outcome` for model/parse success.
 */
export async function evaluateCompletedSession(
  actor: AuthenticatedUser,
  sessionId: string,
): Promise<EvaluateCompletedSessionResult> {
  const session = await getSessionByIdOrThrow(actor, sessionId);
  assertOwnerForEvaluation(actor, session);

  if (session.status !== SessionStatus.COMPLETED) {
    throw new AnalysisServiceError(
      400,
      "Analysis is only available for completed sessions",
      "VALIDATION_ERROR",
    );
  }

  const running = await analysisRepo.findRunningAnalysisForSession(sessionId);
  if (running) {
    throw new AnalysisServiceError(409, "An analysis is already running for this session", "CONFLICT");
  }

  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new AnalysisServiceError(
      503,
      "OpenAI is not configured (set OPENAI_API_KEY)",
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

  const questions = session.template?.questions ?? [];
  const byQid = new Map(questions.map((q) => [q.id, q]));
  const items = responses
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((r) => {
      const q = byQid.get(r.templateQuestionId);
      return {
        ordinal: r.ordinal,
        promptText: q?.promptText ?? "(Missing question text)",
        transcriptText: r.transcriptText,
        audioUrl: r.audioUrl,
        durationSec: r.durationSec,
      };
    });

  const record = await analysisRepo.createRunningAnalysis(sessionId);

  try {
    const { rawText, evaluation } = await runSessionEvaluationModel({
      sessionTitle: session.title,
      templateTitle: session.template?.title ?? null,
      sessionType: session.template?.sessionType ?? SessionType.GUIDED_DIALOGUE,
      items,
    });

    const payloadJson: Prisma.InputJsonValue = {
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
      resultKind: ANALYSIS_RESULT_KIND,
      rawModelOutput: rawText,
      evaluation: {
        overallScore: evaluation.overallScore,
        fluencyScore: evaluation.fluencyScore,
        technicalAccuracyScore: evaluation.technicalAccuracyScore,
        clientCommunicationScore: evaluation.clientCommunicationScore,
        professionalismScore: evaluation.professionalismScore,
        confidenceScore: evaluation.confidenceScore,
        readinessLevel: evaluation.readinessLevel,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        recommendations: evaluation.recommendations,
      },
    };

    await analysisRepo.markAnalysisCompleted(record.id, {
      model: env.OPENAI_EVAL_MODEL,
      summary: evaluation.summary,
      payloadJson,
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

/**
 * Latest analysis row for a session. Caller must enforce `analyses:view` + session visibility (see GET route).
 */
export async function getLatestAnalysisForSession(actor: AuthenticatedUser, sessionId: string) {
  await getSessionByIdOrThrow(actor, sessionId);
  return analysisRepo.findLatestAnalysisBySessionId(sessionId);
}

