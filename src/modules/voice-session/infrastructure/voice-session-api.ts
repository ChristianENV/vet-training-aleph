import { parseApiJsonResponse } from "@/lib/http/api-client";
import type { VoiceEventType } from "@/modules/voice-session/domain/voice-event-types";

export type VoiceTransportMode = "webrtc" | "websocket";

export type VoiceTranscriptTurnDto = {
  id: string;
  speaker: "assistant" | "user" | "system";
  text: string;
  clientTurnId?: string | null;
  sourceClientEventId?: string | null;
  createdAt: string;
  sequence: number;
  isFinal: boolean;
};

export type VoiceSessionEventDto = {
  id: string;
  type: string;
  clientEventId?: string | null;
  payloadJson: unknown;
  createdAt: string;
  sequence: number;
};

export type VoiceSessionConnectResponse = {
  sessionId: string;
  connectionId: string;
  status: "bootstrap_ready" | "reconnected";
  transport: {
    mode: VoiceTransportMode;
    eventsUrl: string;
    heartbeatIntervalMs: number;
  };
  capabilities: {
    acceptsAudioStream: boolean;
    acceptsTextEvents: boolean;
    serverTranscription: "none" | "partial" | "full";
  };
  handoff: {
    endSessionUrl: string;
  };
  bootstrap: {
    ephemeralKey: string;
    model: string;
    voice: string;
    expiresAt: string | null;
    instructions: string | null;
  };
  history: {
    turns: VoiceTranscriptTurnDto[];
    events: VoiceSessionEventDto[];
  };
};

export type VoiceSessionEventType = VoiceEventType;

export type VoiceSessionEventPayload = {
  eventId: string;
  type: VoiceSessionEventType;
  occurredAt: string;
  connectionId?: string | null;
  payload?: Record<string, unknown>;
  turn?: {
    speaker: "assistant" | "user" | "system";
    text: string;
    isFinal?: boolean;
    clientTurnId?: string;
  };
};

export type VoiceSessionEventResponse = {
  acknowledged: boolean;
  duplicate: boolean;
  acceptedAt: string;
  sequence: number;
  persistedTurn: VoiceTranscriptTurnDto | null;
  persistedEvent: VoiceSessionEventDto;
};

export type VoiceSessionEndResponse = {
  sessionId: string;
  status: "ending" | "ended";
  idempotentReplay?: boolean;
  endedAt?: string;
  handoff: {
    nextAction: "stay_on_voice_screen" | "open_classic_session" | "open_analysis_when_ready";
    pollSessionStatus: boolean;
    analysis: {
      route: string;
      autoTriggered: boolean;
      prepared: boolean;
      itemCount: number;
      analysisId?: string | null;
      outcome?: "SUCCEEDED" | "FAILED" | null;
    };
  };
};

export async function connectVoiceSessionRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/voice/connect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<VoiceSessionConnectResponse>(res);
}

export async function sendVoiceSessionEventRequest(sessionId: string, event: VoiceSessionEventPayload) {
  const res = await fetch(`/api/sessions/${sessionId}/voice/events`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  return parseApiJsonResponse<VoiceSessionEventResponse>(res);
}

export async function endVoiceSessionRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/voice/end`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<VoiceSessionEndResponse>(res);
}

