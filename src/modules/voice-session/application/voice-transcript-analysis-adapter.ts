import type { VoiceTranscriptTurnDto } from "@/modules/voice-session/infrastructure/voice-session-api";

export type VoiceAnalysisItem = {
  ordinal: number;
  promptText: string;
  transcriptText: string;
  durationSec: number | null;
};

/**
 * Converts conversational voice turns into a coarse question/answer-like input
 * so existing session analysis pathways can be adopted incrementally.
 */
export function buildAnalysisItemsFromVoiceTurns(turns: VoiceTranscriptTurnDto[]): VoiceAnalysisItem[] {
  const assistantTurns = turns.filter((t) => t.speaker === "assistant" && t.isFinal && t.text.trim());
  const userTurns = turns.filter((t) => t.speaker === "user" && t.isFinal && t.text.trim());

  const pairs = Math.max(assistantTurns.length, userTurns.length);
  const out: VoiceAnalysisItem[] = [];
  for (let i = 0; i < pairs; i++) {
    const assistant = assistantTurns[i];
    const user = userTurns[i];
    if (!assistant && !user) continue;
    out.push({
      ordinal: i + 1,
      promptText: assistant?.text ?? "Assistant guidance",
      transcriptText: user?.text ?? "",
      durationSec: null,
    });
  }
  return out;
}

