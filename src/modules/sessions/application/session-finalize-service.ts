import { SessionStatus } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getServerEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { buildOralAssessmentObjectKey } from "@/lib/storage/oral-assessment-key";
import { isR2Configured, uploadToR2WithRetry } from "@/lib/storage/r2-upload";
import { evaluateCompletedSession } from "@/modules/analyses/application/session-analysis-service";
import type { EvaluateCompletedSessionResult } from "@/modules/analyses/application/session-analysis-service";
import { isTranscriptTextSufficient } from "@/modules/sessions/domain/transcript-readiness";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";
import { recordSessionFinalizeIncident } from "@/modules/sessions/infrastructure/technical-incident-logging";
import { runFinalAudioTranscriptionPhase } from "@/modules/sessions/application/session-transcription-service";
import { SessionsServiceError } from "@/modules/sessions/application/session-service";

function responseRowSatisfied(r: {
  transcriptText: string | null;
  finalAudioStorageKey: string | null;
  finalAudioDurationSec: number | null;
}): boolean {
  if (r.transcriptText?.trim() || r.finalAudioStorageKey?.trim()) return true;
  return (r.finalAudioDurationSec ?? 0) > 0;
}

export type FinalizeSessionWithUploadsResult = {
  session: NonNullable<Awaited<ReturnType<typeof sessionRepo.getSessionById>>>;
  evaluation: EvaluateCompletedSessionResult | null;
  transcriptionFailed: boolean;
};

/**
 * Uploads final takes to R2 (or dev placeholders), transcribes audio, persists transcripts, runs automatic analysis.
 */
export async function finalizeSessionWithUploads(
  actor: AuthenticatedUser,
  sessionId: string,
  uploads: Map<string, { buffer: Buffer; contentType: string }>,
): Promise<FinalizeSessionWithUploadsResult> {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  if (session.userId !== actor.id) {
    throw new SessionsServiceError(403, "You cannot finish this session", "FORBIDDEN");
  }
  if (session.status !== SessionStatus.ACTIVE) {
    throw new SessionsServiceError(
      400,
      "Only an in-progress session can be finished",
      "VALIDATION_ERROR",
    );
  }

  const env = getServerEnv();
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { email: true, name: true },
  });
  if (!user) {
    throw new SessionsServiceError(404, "User not found", "NOT_FOUND");
  }

  const now = new Date();
  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.SAVING_FINAL_RESPONSES,
    lastActivityAt: now,
  });

  const questions = [...(session.sessionQuestions ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const required = questions.filter((q) => q.isRequired);
  const responses = session.responses ?? [];
  const byQ = new Map(responses.map((r) => [r.sessionQuestionId, r]));

  const transcriptFallbackOrdinals: number[] = [];
  const freshUploads = new Map<string, { buffer: Buffer; contentType: string }>();

  const rollbackToActive = async () => {
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.ACTIVE,
      lastActivityAt: new Date(),
    });
  };

  for (const q of required) {
    const r = byQ.get(q.id);
    if (!r) {
      await rollbackToActive();
      throw new SessionsServiceError(
        400,
        `Missing saved answer for question ${q.ordinal}`,
        "VALIDATION_ERROR",
      );
    }

    if (r.finalAudioStorageKey?.trim()) {
      continue;
    }

    const upload = uploads.get(q.id);
    if (upload && upload.buffer.length > 0) {
      const key = buildOralAssessmentObjectKey({
        sessionId,
        ordinal: q.ordinal,
        userName: user.name,
        userEmail: user.email,
        mimeType: upload.contentType || "audio/webm",
      });
      try {
        if (isR2Configured(env)) {
          await uploadToR2WithRetry(env, {
            key,
            body: upload.buffer,
            contentType: upload.contentType || "application/octet-stream",
          });
        }
        await sessionRepo.updateSessionResponseFinalAudio({
          sessionId,
          sessionQuestionId: q.id,
          finalAudioStorageKey: key,
          finalAudioProvider: isR2Configured(env) ? "r2" : "dev-placeholder",
          finalAudioMimeType: upload.contentType,
          finalAudioBytes: upload.buffer.length,
        });
        freshUploads.set(q.id, {
          buffer: upload.buffer,
          contentType: upload.contentType || "application/octet-stream",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        await recordSessionFinalizeIncident({
          userId: actor.id,
          sessionId,
          sessionQuestionId: q.id,
          stage: "final_audio_upload",
          provider: isR2Configured(env) ? "r2" : "none",
          errorMessage: msg.slice(0, 8000),
          detailsJson: { questionOrdinal: q.ordinal },
        });
        if (isTranscriptTextSufficient(r.transcriptText)) {
          transcriptFallbackOrdinals.push(q.ordinal);
          continue;
        }
        await rollbackToActive();
        throw new SessionsServiceError(
          422,
          `We couldn’t save your voice answer for question ${q.ordinal}. Add a bit more in the written support field (about a sentence), or try finishing again.`,
          "FINALIZE_RECOVERABLE",
        );
      }
    } else if (isTranscriptTextSufficient(r.transcriptText)) {
      transcriptFallbackOrdinals.push(q.ordinal);
    } else if ((r.finalAudioDurationSec ?? 0) > 0 && !r.finalAudioStorageKey?.trim()) {
      await rollbackToActive();
      throw new SessionsServiceError(
        422,
        `Question ${q.ordinal} still needs a saved recording or enough written support before you can finish.`,
        "FINALIZE_RECOVERABLE",
      );
    }
  }

  const fresh = await sessionRepo.getSessionById(sessionId);
  if (!fresh) {
    await rollbackToActive();
    throw new SessionsServiceError(500, "Session could not be reloaded", "VALIDATION_ERROR");
  }
  const byFresh = new Map((fresh.responses ?? []).map((x) => [x.sessionQuestionId, x]));
  for (const q of required) {
    const r = byFresh.get(q.id);
    if (!r || !responseRowSatisfied(r)) {
      await rollbackToActive();
      throw new SessionsServiceError(
        400,
        `Question ${q.ordinal} is not ready to finish`,
        "VALIDATION_ERROR",
      );
    }
  }

  await sessionRepo.updateTrainingSessionFinalizationMeta(sessionId, {
    transcriptFallbackOrdinals,
  });

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.TRANSCRIBING,
    lastActivityAt: new Date(),
  });

  const transcription = await runFinalAudioTranscriptionPhase(actor, sessionId, freshUploads);

  if (!transcription.ok) {
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.TRANSCRIPTION_FAILED,
      lastActivityAt: new Date(),
    });
    await sessionRepo.mergeSessionFinalizationMeta(sessionId, {
      transcriptionLastError: transcription.message,
    });
    const failedSession = await sessionRepo.getSessionById(sessionId);
    if (!failedSession) {
      throw new SessionsServiceError(500, "Session not found after transcription failure", "NOT_FOUND");
    }
    return { session: failedSession, evaluation: null, transcriptionFailed: true };
  }

  await sessionRepo.mergeSessionFinalizationMeta(sessionId, {
    transcriptionLastError: null,
  });

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.ANALYZING,
    lastActivityAt: new Date(),
  });

  const evaluation = await evaluateCompletedSession(actor, sessionId);
  const out = await sessionRepo.getSessionById(sessionId);
  if (!out) {
    throw new SessionsServiceError(500, "Session not found after finalize", "NOT_FOUND");
  }
  return { session: out, evaluation, transcriptionFailed: false };
}

/**
 * Retry transcription + evaluation after TRANSCRIPTION_FAILED (audio already saved).
 */
export async function resumePostFinalizeTranscription(
  actor: AuthenticatedUser,
  sessionId: string,
): Promise<FinalizeSessionWithUploadsResult> {
  const session = await sessionRepo.getSessionById(sessionId);
  if (!session) {
    throw new SessionsServiceError(404, "Session not found", "NOT_FOUND");
  }
  if (session.userId !== actor.id) {
    throw new SessionsServiceError(403, "You cannot update this session", "FORBIDDEN");
  }
  if (session.status !== SessionStatus.TRANSCRIPTION_FAILED) {
    throw new SessionsServiceError(
      400,
      "Only sessions that are waiting to prepare voice answers for scoring can be retried here.",
      "VALIDATION_ERROR",
    );
  }

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.TRANSCRIBING,
    lastActivityAt: new Date(),
  });

  const transcription = await runFinalAudioTranscriptionPhase(actor, sessionId, new Map());

  if (!transcription.ok) {
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.TRANSCRIPTION_FAILED,
      lastActivityAt: new Date(),
    });
    await sessionRepo.mergeSessionFinalizationMeta(sessionId, {
      transcriptionLastError: transcription.message,
    });
    const failedSession = await sessionRepo.getSessionById(sessionId);
    if (!failedSession) {
      throw new SessionsServiceError(500, "Session not found", "NOT_FOUND");
    }
    return { session: failedSession, evaluation: null, transcriptionFailed: true };
  }

  await sessionRepo.mergeSessionFinalizationMeta(sessionId, {
    transcriptionLastError: null,
  });

  await sessionRepo.updateSessionStatus({
    sessionId,
    status: SessionStatus.ANALYZING,
    lastActivityAt: new Date(),
  });

  const evaluation = await evaluateCompletedSession(actor, sessionId);
  const out = await sessionRepo.getSessionById(sessionId);
  if (!out) {
    throw new SessionsServiceError(500, "Session not found after resume", "NOT_FOUND");
  }
  return { session: out, evaluation, transcriptionFailed: false };
}
