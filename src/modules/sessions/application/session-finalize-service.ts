import { SessionStatus } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getServerEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { writeDevAudioCache } from "@/lib/storage/dev-audio-cache";
import { resolveSessionResponseForQuestion } from "@/modules/sessions/domain/resolve-session-response-for-question";
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
  /** Present when `transcriptionFailed` is true — server-side reason for UI. */
  transcriptionFailureMessage?: string | null;
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

  const transcriptFallbackOrdinals: number[] = [];
  const freshUploads = new Map<string, { buffer: Buffer; contentType: string }>();
  const r2On = isR2Configured(env);

  if (!r2On) {
    const anyVoice = required.some((q) => {
      const row = resolveSessionResponseForQuestion(q, responses);
      return (
        !!row &&
        ((row.finalAudioDurationSec ?? 0) > 0 ||
          (row.finalAudioBytes ?? 0) > 0 ||
          !!row.finalAudioMimeType?.trim())
      );
    });
    if (anyVoice) {
      console.warn(
        "[sessions:finalize] R2 is not fully configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY plus either R2_ENDPOINT and R2_BUCKET, or R2_ACCOUNT_ID and R2_BUCKET_NAME (endpoint is derived). Without these, voice files are not sent to Cloudflare; keys are dev placeholders only.",
      );
    }
  }

  const rollbackToActive = async () => {
    await sessionRepo.updateSessionStatus({
      sessionId,
      status: SessionStatus.ACTIVE,
      lastActivityAt: new Date(),
    });
  };

  for (const q of required) {
    const r = resolveSessionResponseForQuestion(q, responses);
    if (!r) {
      await rollbackToActive();
      throw new SessionsServiceError(
        400,
        `Missing saved answer for question ${q.ordinal}`,
        "VALIDATION_ERROR",
      );
    }

    const upload = uploads.get(q.id);
    const uploadOk = !!(upload && upload.buffer.length > 0);

    /** Real object in bucket — skip re-upload. */
    const storedInR2 = r.finalAudioProvider === "r2" && !!r.finalAudioStorageKey?.trim();
    if (storedInR2) {
      continue;
    }

    const transcriptOk = isTranscriptTextSufficient(r.transcriptText);
    const voiceMetadata =
      (r.finalAudioDurationSec ?? 0) > 0 ||
      (r.finalAudioBytes ?? 0) > 0 ||
      !!r.finalAudioMimeType?.trim();

    if (uploadOk && upload) {
      const key = buildOralAssessmentObjectKey({
        sessionId,
        ordinal: q.ordinal,
        userName: user.name,
        userEmail: user.email,
        mimeType: upload.contentType || "audio/webm",
      });
      try {
        if (r2On) {
          await uploadToR2WithRetry(env, {
            key,
            body: upload.buffer,
            contentType: upload.contentType || "application/octet-stream",
          });
          if (process.env.NODE_ENV === "development") {
            console.info(`[sessions:finalize] R2 upload ok bytes=${upload.buffer.length}`);
          }
        }
        await sessionRepo.updateSessionResponseFinalAudio({
          sessionId,
          sessionQuestionId: q.id,
          finalAudioStorageKey: key,
          finalAudioProvider: r2On ? "r2" : "dev-placeholder",
          finalAudioMimeType: upload.contentType,
          finalAudioBytes: upload.buffer.length,
        });
        freshUploads.set(q.id, {
          buffer: upload.buffer,
          contentType: upload.contentType || "application/octet-stream",
        });
        if (!r2On) {
          await writeDevAudioCache(sessionId, q.id, upload.buffer, upload.contentType);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        console.warn(
          `[sessions:finalize] final_audio_upload failed session=${sessionId} questionOrdinal=${q.ordinal}:`,
          msg.slice(0, 400),
        );
        await recordSessionFinalizeIncident({
          userId: actor.id,
          sessionId,
          sessionQuestionId: q.id,
          stage: "final_audio_upload",
          provider: r2On ? "r2" : "none",
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
      continue;
    }

    if (transcriptOk) {
      transcriptFallbackOrdinals.push(q.ordinal);
      continue;
    }

    if (!r2On && r.finalAudioStorageKey?.trim()) {
      continue;
    }

    if (r2On && voiceMetadata) {
      await rollbackToActive();
      throw new SessionsServiceError(
        422,
        `We couldn’t receive your voice recording for question ${q.ordinal}. Keep this page open while finishing (don’t refresh), save each answer first, then finish — or add a short written note if speech isn’t available.`,
        "FINALIZE_RECOVERABLE",
      );
    }

    if ((r.finalAudioDurationSec ?? 0) > 0 && !r.finalAudioStorageKey?.trim()) {
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
  const freshResponses = fresh.responses ?? [];
  for (const q of required) {
    const r = resolveSessionResponseForQuestion(q, freshResponses);
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
    return {
      session: failedSession,
      evaluation: null,
      transcriptionFailed: true,
      transcriptionFailureMessage: transcription.message,
    };
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
    return {
      session: failedSession,
      evaluation: null,
      transcriptionFailed: true,
      transcriptionFailureMessage: transcription.message,
    };
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
