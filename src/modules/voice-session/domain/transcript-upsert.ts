import type { VoiceTranscriptTurn } from "./transcript-model";

export function upsertTranscriptTurn(
  existing: VoiceTranscriptTurn[],
  turn: VoiceTranscriptTurn,
): VoiceTranscriptTurn[] {
  const byIdIdx = existing.findIndex((p) => p.id === turn.id);
  if (byIdIdx >= 0) {
    const next = [...existing];
    next[byIdIdx] = { ...next[byIdIdx], ...turn };
    return next;
  }
  if (turn.sequence != null) {
    const bySeqIdx = existing.findIndex((p) => p.sequence === turn.sequence);
    if (bySeqIdx >= 0) {
      const next = [...existing];
      next[bySeqIdx] = { ...next[bySeqIdx], ...turn };
      return next;
    }
  }
  return [...existing, turn].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

