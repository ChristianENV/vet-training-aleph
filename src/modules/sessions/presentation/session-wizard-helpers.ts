import type { SessionQuestionRow, SessionResponseRow } from "./sessions-api";

export function responseHasContent(
  r: {
    transcriptText: string | null;
    finalAudioStorageKey: string | null;
    finalAudioDurationSec?: number | null;
  } | undefined,
): boolean {
  if (!r) return false;
  if (r.transcriptText?.trim() || r.finalAudioStorageKey?.trim()) return true;
  return (r.finalAudioDurationSec ?? 0) > 0;
}

/** First index (in ordinal order) of a question without a saved answer, or -1 if all have content. */
export function indexOfFirstUnsatisfied(
  questions: SessionQuestionRow[],
  responseByQuestion: Map<string, SessionResponseRow>,
): number {
  const ordered = [...questions].sort((a, b) => a.ordinal - b.ordinal);
  for (let i = 0; i < ordered.length; i++) {
    const r = responseByQuestion.get(ordered[i].id);
    if (!responseHasContent(r)) return i;
  }
  return -1;
}

export function formatSuggestedFocusLabel(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 60) {
    return `~${seconds} sec focus`;
  }
  const m = seconds / 60;
  const rounded = Math.round(m * 10) / 10;
  const label = rounded === Math.floor(rounded) ? String(Math.floor(rounded)) : String(rounded);
  return `~${label} min focus`;
}

/** Prefer suggested, then expected; both are hints, not deadlines. */
export function pickGuidanceSeconds(q: SessionQuestionRow): number | null {
  return q.suggestedDurationSec ?? q.expectedDurationSec ?? null;
}

export type LocalVoiceTake = {
  blob: Blob;
  objectUrl: string;
  durationSec: number;
  mimeType: string;
  byteLength: number;
};

/** True when a local recording exists that is not yet reflected in the saved response. */
export function hasUnsavedLocalVoiceTake(
  local: LocalVoiceTake | null | undefined,
  saved: SessionResponseRow | undefined,
): boolean {
  if (!local) return false;
  if (!saved || !responseHasContent(saved)) return true;
  const durMatch = Math.abs((saved.finalAudioDurationSec ?? 0) - local.durationSec) < 0.75;
  if (!durMatch) return true;
  if (saved.finalAudioBytes != null) {
    return saved.finalAudioBytes !== local.byteLength;
  }
  return false;
}

export function findPrevNavigableQuestionId(
  ordered: SessionQuestionRow[],
  currentId: string | null,
  isLocked: (q: SessionQuestionRow) => boolean,
): string | null {
  if (!currentId) return null;
  const idx = ordered.findIndex((q) => q.id === currentId);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const q = ordered[i];
    if (!isLocked(q)) return q.id;
  }
  return null;
}

export function findNextNavigableQuestionId(
  ordered: SessionQuestionRow[],
  currentId: string | null,
  isLocked: (q: SessionQuestionRow) => boolean,
): string | null {
  if (!currentId) return null;
  const idx = ordered.findIndex((q) => q.id === currentId);
  if (idx < 0 || idx >= ordered.length - 1) return null;
  for (let i = idx + 1; i < ordered.length; i++) {
    const q = ordered[i];
    if (!isLocked(q)) return q.id;
  }
  return null;
}
