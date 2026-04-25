export type VoiceTranscriptSpeaker = "assistant" | "user" | "system";

export type VoiceTranscriptTurn = {
  id: string;
  speaker: VoiceTranscriptSpeaker;
  text: string;
  createdAt: string;
  sequence?: number;
  isInterim: boolean;
  isFinal: boolean;
};

export function createTranscriptTurn(input: {
  speaker: VoiceTranscriptSpeaker;
  text: string;
  isInterim?: boolean;
  isFinal?: boolean;
}): VoiceTranscriptTurn {
  return {
    id: `turn-${Math.random().toString(36).slice(2, 10)}`,
    speaker: input.speaker,
    text: input.text,
    createdAt: new Date().toISOString(),
    isInterim: input.isInterim ?? false,
    isFinal: input.isFinal ?? !input.isInterim,
  };
}

