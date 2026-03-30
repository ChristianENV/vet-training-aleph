/**
 * Maps stored technical codes / enum-like strings to readable copy.
 * Use when displaying server-persisted `errorMessage` or similar fields.
 */
const ENUM_STYLE_ERROR_COPY: Record<string, string> = {
  TRANSCRIPTION_FAILED:
    "We couldn’t prepare your voice answers for scoring. Your responses are saved — use “Try preparing again” on the session page.",
  TRANSCRIPTS_NOT_READY:
    "Scoring needs transcripts for each answer. Finish preparing your answers on the session page, then run evaluation again.",
};

/** Looks like `SOME_ENUM_CONSTANT` (not a sentence). */
function looksLikeEnumConstant(s: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(s) && s.includes("_") && s.length <= 80;
}

export function formatStoredTechnicalError(raw: string | null | undefined): string {
  if (raw == null) {
    return "Something went wrong. You can try again.";
  }
  const t = String(raw).trim();
  if (!t) {
    return "Something went wrong. You can try again.";
  }
  if (ENUM_STYLE_ERROR_COPY[t]) {
    return ENUM_STYLE_ERROR_COPY[t];
  }
  if (looksLikeEnumConstant(t)) {
    return "Something went wrong while processing. Please try again, or contact support if this continues.";
  }
  return t;
}
