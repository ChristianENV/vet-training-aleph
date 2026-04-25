import { TranscriptStatus } from "@/generated/prisma/enums";

/**
 * Minimum transcript length required to treat transcripts as usable evidence.
 * This is intentionally low to avoid false "no transcripts" recoverable states when
 * the model produced short-but-real speech text.
 */
export const MIN_TRANSCRIPT_CHARS_FOR_EVALUATION = 5;

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
  // We treat "sufficient transcript text exists" as the source of truth for availability.
  // `transcriptStatus` can lag behind (or be overwritten to FAILED during retries) while the
  // stored `transcriptText` is still usable for evaluation.
  return isTranscriptTextSufficient(r.transcriptText);
}
