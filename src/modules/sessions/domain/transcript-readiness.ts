import { TranscriptStatus } from "@/generated/prisma/enums";

/** Minimum transcript length for enriched evaluation and post-finalize checks. */
export const MIN_TRANSCRIPT_CHARS_FOR_EVALUATION = 50;

export function isTranscriptTextSufficient(text: string | null | undefined): boolean {
  return (text?.trim().length ?? 0) >= MIN_TRANSCRIPT_CHARS_FOR_EVALUATION;
}

/**
 * Required answers are ready for enriched evaluation:
 * - Voice-backed rows: final audio exists and transcript was produced (or failed path blocked earlier).
 * - Text-only (no stored audio key): learner support text must be long enough.
 */
export function responseRowReadyForEnrichedEvaluation(r: {
  finalAudioStorageKey: string | null | undefined;
  transcriptText: string | null | undefined;
  transcriptStatus: TranscriptStatus | string | null | undefined;
}): boolean {
  const hasAudio = !!r.finalAudioStorageKey?.trim();
  if (hasAudio) {
    return (
      r.transcriptStatus === TranscriptStatus.AVAILABLE &&
      isTranscriptTextSufficient(r.transcriptText)
    );
  }
  return isTranscriptTextSufficient(r.transcriptText);
}
