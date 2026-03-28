import { AiUsageLogStatus, TranscriptStatus } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getServerEnv } from "@/lib/config/env";
import { downloadObjectFromR2 } from "@/lib/storage/r2-download";
import { isR2Configured } from "@/lib/storage/r2-upload";
import { transcribeAudioBuffer } from "@/modules/openai/application/transcribe-audio-buffer";
import { getTranscriptionModelName } from "@/modules/openai/infrastructure/openai-client";
import {
  isTranscriptTextSufficient,
  responseRowReadyForEnrichedEvaluation,
} from "@/modules/sessions/domain/transcript-readiness";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";
import { recordSessionFinalizeIncident } from "@/modules/sessions/infrastructure/technical-incident-logging";
import { recordTranscriptionAiUsage } from "@/modules/sessions/infrastructure/transcription-ai-usage-logging";

function guessFilename(mime: string | null | undefined, ordinal: number): string {
  const m = (mime ?? "").toLowerCase();
  const ext = m.includes("webm")
    ? "webm"
    : m.includes("mp3")
      ? "mp3"
      : m.includes("wav")
        ? "wav"
        : "webm";
  return `question-${ordinal}-final.${ext}`;
}

/**
 * Transcribes final saved audio for each required response, or marks support-field text as ready.
 * Call when session is in TRANSCRIBING. `freshUploads` holds buffers from the same HTTP finalize request when R2 is off.
 */
export async function runFinalAudioTranscriptionPhase(
  actor: AuthenticatedUser,
  sessionId: string,
  freshUploads: Map<string, { buffer: Buffer; contentType: string }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      message: "Speech-to-text is not available on the server right now. Your answers are saved — try again shortly.",
    };
  }

  const session = await sessionRepo.getSessionById(sessionId);
  if (!session || session.userId !== actor.id) {
    return { ok: false, message: "Session not found." };
  }

  const questions = [...(session.sessionQuestions ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const required = questions.filter((q) => q.isRequired);
  const byQ = new Map((session.responses ?? []).map((r) => [r.sessionQuestionId, r]));

  const recoverableMsg =
    "We saved your responses, but couldn’t prepare them for scoring yet. You can try again — nothing needs to be re-recorded.";

  for (const q of required) {
    const r = byQ.get(q.id);
    if (!r) {
      return { ok: false, message: recoverableMsg };
    }

    const audioKey = r.finalAudioStorageKey?.trim();
    if (!audioKey) {
      if (!isTranscriptTextSufficient(r.transcriptText)) {
        return { ok: false, message: recoverableMsg };
      }
      await sessionRepo.markSupportFieldTranscriptReady({
        sessionId,
        sessionQuestionId: q.id,
      });
      continue;
    }

    const fresh = freshUploads.get(q.id);
    let buffer: Buffer | null = fresh?.buffer ?? null;
    const contentType =
      fresh?.contentType ?? r.finalAudioMimeType ?? "application/octet-stream";

    if (!buffer) {
      try {
        if (!isR2Configured(env)) {
          await recordSessionFinalizeIncident({
            userId: actor.id,
            sessionId,
            sessionQuestionId: q.id,
            stage: "final_audio_transcription",
            provider: "storage",
            errorMessage: "No in-memory upload buffer and R2 is not configured",
            detailsJson: { ordinal: q.ordinal },
          });
          await sessionRepo.updateSessionResponseTranscriptFailure({
            sessionId,
            sessionQuestionId: q.id,
          });
          return { ok: false, message: recoverableMsg };
        }
        buffer = await downloadObjectFromR2(env, audioKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Download failed";
        await recordSessionFinalizeIncident({
          userId: actor.id,
          sessionId,
          sessionQuestionId: q.id,
          stage: "final_audio_transcription",
          provider: "r2",
          errorMessage: msg.slice(0, 8000),
          detailsJson: { ordinal: q.ordinal, phase: "download" },
        });
        await sessionRepo.updateSessionResponseTranscriptFailure({
          sessionId,
          sessionQuestionId: q.id,
        });
        return { ok: false, message: recoverableMsg };
      }
    }

    const filename = guessFilename(contentType, q.ordinal);

    try {
      const { text, model } = await transcribeAudioBuffer({
        buffer,
        filename,
        mimeType: contentType || "application/octet-stream",
      });

      if (!isTranscriptTextSufficient(text)) {
        await recordSessionFinalizeIncident({
          userId: actor.id,
          sessionId,
          sessionQuestionId: q.id,
          stage: "final_audio_transcription",
          provider: "openai",
          errorMessage: "Transcription empty or too short for scoring",
          detailsJson: { ordinal: q.ordinal, charCount: text.length },
        });
        await sessionRepo.updateSessionResponseTranscriptFailure({
          sessionId,
          sessionQuestionId: q.id,
        });
        await recordTranscriptionAiUsage({
          userId: actor.id,
          sessionId,
          model,
          status: AiUsageLogStatus.FAILED,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          requestMetaJson: { sessionQuestionId: q.id, ordinal: q.ordinal },
          responseMetaJson: { error: "empty_or_short_transcript" },
        });
        return { ok: false, message: recoverableMsg };
      }

      await sessionRepo.updateSessionResponseTranscriptResult({
        sessionId,
        sessionQuestionId: q.id,
        transcriptText: text,
        transcriptStatus: TranscriptStatus.AVAILABLE,
        transcriptProvider: "openai",
      });

      await recordTranscriptionAiUsage({
        userId: actor.id,
        sessionId,
        model,
        status: AiUsageLogStatus.SUCCESS,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        requestMetaJson: { sessionQuestionId: q.id, ordinal: q.ordinal },
        responseMetaJson: { textLength: text.length },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transcription failed";
      await recordSessionFinalizeIncident({
        userId: actor.id,
        sessionId,
        sessionQuestionId: q.id,
        stage: "final_audio_transcription",
        provider: "openai",
        errorMessage: msg.slice(0, 8000),
        detailsJson: { ordinal: q.ordinal },
      });
      await sessionRepo.updateSessionResponseTranscriptFailure({
        sessionId,
        sessionQuestionId: q.id,
      });
      await recordTranscriptionAiUsage({
        userId: actor.id,
        sessionId,
        model: getTranscriptionModelName(),
        status: AiUsageLogStatus.FAILED,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        requestMetaJson: { sessionQuestionId: q.id, ordinal: q.ordinal },
        responseMetaJson: { error: msg.slice(0, 500) },
      });
      return { ok: false, message: recoverableMsg };
    }
  }

  const verify = await sessionRepo.getSessionById(sessionId);
  if (!verify) {
    return { ok: false, message: recoverableMsg };
  }
  const byFresh = new Map((verify.responses ?? []).map((x) => [x.sessionQuestionId, x]));
  for (const q of required) {
    const r = byFresh.get(q.id);
    if (!r || !responseRowReadyForEnrichedEvaluation(r)) {
      return { ok: false, message: recoverableMsg };
    }
  }

  return { ok: true };
}
