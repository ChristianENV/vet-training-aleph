import { getServerEnv } from "@/lib/config/env";

export type RealtimeSessionBootstrap = {
  clientSecret: string;
  model: string;
  voice: string;
  expiresAt: string | null;
  instructions: string | null;
};

/**
 * Creates an ephemeral Realtime session token for browser WebRTC usage.
 * Server-side only: never expose long-lived OPENAI_API_KEY to clients.
 */
export async function createRealtimeSessionBootstrap(input: {
  sessionTitle: string | null;
  sessionId: string;
}): Promise<RealtimeSessionBootstrap> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for realtime voice sessions.");
  }

  const instructions = [
    "You are a spoken English coach for veterinarians working with US clients.",
    "Keep responses concise, practical, and natural for spoken conversation.",
    "Ask one clear follow-up question at a time and adapt to user responses.",
    `Session ID: ${input.sessionId}`,
    input.sessionTitle ? `Session title: ${input.sessionTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_REALTIME_MODEL,
      voice: env.OPENAI_REALTIME_VOICE,
      instructions,
      modalities: ["audio", "text"],
      input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Realtime bootstrap failed: ${res.status} ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    client_secret?: { value?: string };
    model?: string;
    voice?: string;
    expires_at?: string;
    instructions?: string;
  };

  const clientSecret = json.client_secret?.value?.trim();
  if (!clientSecret) {
    throw new Error("Realtime bootstrap response did not include client secret.");
  }

  return {
    clientSecret,
    model: json.model ?? env.OPENAI_REALTIME_MODEL,
    voice: json.voice ?? env.OPENAI_REALTIME_VOICE,
    expiresAt: json.expires_at ?? null,
    instructions: json.instructions ?? instructions,
  };
}

