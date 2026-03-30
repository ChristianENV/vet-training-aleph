import { TranscriptStatus } from "@/generated/prisma/enums";

/** Minimum transcript length for enriched evaluation and post-finalize checks. */
export const MIN_TRANSCRIPT_CHARS_FOR_EVALUATION = 50;

export function isTranscriptTextSufficient(text: string | null | undefined): boolean {
  return (text?.trim().length ?? 0) >= MIN_TRANSCRIPT_CHARS_FOR_EVALUATION;
}

/**
 * Required answers are ready for enriched evaluation when transcript text is long enough
 * and transcription did not hard-fail. Voice-backed rows previously required
 * `transcriptStatus === AVAILABLE` even when transcript text was already saved; that could
 * reject or confuse the pipeline if status lagged behind the stored text.
 */
export function responseRowReadyForEnrichedEvaluation(r: {
  finalAudioStorageKey: string | null | undefined;
  transcriptText: string | null | undefined;
  transcriptStatus: TranscriptStatus | string | null | undefined;
}): boolean {
  if (r.transcriptStatus === TranscriptStatus.FAILED) return false;
  if (String(r.transcriptStatus ?? "").toUpperCase() === "FAILED") return false;
  return isTranscriptTextSufficient(r.transcriptText);
}
