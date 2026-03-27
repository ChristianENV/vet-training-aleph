import { SessionStatus, SessionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { roleHasPermission } from "@/lib/auth/permissions";
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

export async function evaluateCompletedSession(actor: AuthenticatedUser, sessionId: string) {
  if (!roleHasPermission(actor.role, "analyses:request")) {
    throw new AnalysisServiceError(403, "Missing permission: analyses:request", "FORBIDDEN");
  }

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
  return latest;
}

export async function getLatestAnalysisForSession(actor: AuthenticatedUser, sessionId: string) {
  await getSessionByIdOrThrow(actor, sessionId);

  if (!roleHasPermission(actor.role, "analyses:view")) {
    throw new AnalysisServiceError(403, "Missing permission: analyses:view", "FORBIDDEN");
  }

  return analysisRepo.findLatestAnalysisBySessionId(sessionId);
}

