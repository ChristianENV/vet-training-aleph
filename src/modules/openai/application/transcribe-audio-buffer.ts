import { toFile } from "openai";
import { createOpenAIClient, getTranscriptionModelName } from "@/modules/openai/infrastructure/openai-client";

export type TranscribeAudioBufferResult = {
  text: string;
  model: string;
};

/**
 * OpenAI audio transcription (Whisper-class models). Server-only.
 */
export async function transcribeAudioBuffer(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<TranscribeAudioBufferResult> {
  const client = createOpenAIClient();
  const model = getTranscriptionModelName();
  const file = await toFile(input.buffer, input.filename, { type: input.mimeType });
  const res = await client.audio.transcriptions.create({
    file,
    model,
    language: "en",
  });
  const text = (res.text ?? "").trim();
  return { text, model };
}
