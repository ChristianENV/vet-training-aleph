import {
  connectVoiceSessionRequest,
  endVoiceSessionRequest,
  sendVoiceSessionEventRequest,
  type VoiceSessionConnectResponse,
  type VoiceSessionEndResponse,
  type VoiceSessionEventPayload,
  type VoiceSessionEventResponse,
} from "@/modules/voice-session/infrastructure/voice-session-api";

export type VoiceSessionServiceOptions = {
  useMockTransport?: boolean;
};

export class VoiceSessionService {
  private readonly useMockTransport: boolean;

  constructor(options: VoiceSessionServiceOptions = {}) {
    this.useMockTransport = options.useMockTransport ?? false;
  }

  async connect(sessionId: string): Promise<VoiceSessionConnectResponse> {
    if (this.useMockTransport) {
      return {
        sessionId,
        status: "bootstrap_ready",
        connectionId: `conn-${Date.now()}`,
        transport: {
          mode: "webrtc",
          eventsUrl: `/api/sessions/${sessionId}/voice/events`,
          heartbeatIntervalMs: 15_000,
        },
        capabilities: {
          acceptsAudioStream: true,
          acceptsTextEvents: true,
          serverTranscription: "partial",
        },
        handoff: {
          endSessionUrl: `/api/sessions/${sessionId}/voice/end`,
        },
        history: {
          turns: [],
          events: [],
        },
      };
    }
    return connectVoiceSessionRequest(sessionId);
  }

  async sendEvent(sessionId: string, event: VoiceSessionEventPayload): Promise<VoiceSessionEventResponse> {
    if (this.useMockTransport) {
      return {
        acknowledged: true,
        duplicate: false,
        acceptedAt: new Date().toISOString(),
        sequence: Date.now(),
        persistedTurn: event.turn
          ? {
              id: `turn-${Date.now()}`,
              speaker: event.turn.speaker,
              text: event.turn.text,
              clientTurnId: event.turn.clientTurnId ?? null,
              sourceClientEventId: event.eventId,
              createdAt: new Date().toISOString(),
              sequence: Date.now(),
              isFinal: event.turn.isFinal ?? true,
            }
          : null,
        persistedEvent: {
          id: event.eventId,
          type: event.type,
          clientEventId: event.eventId,
          payloadJson: event.payload ?? {},
          createdAt: new Date().toISOString(),
          sequence: Date.now(),
        },
      };
    }
    return sendVoiceSessionEventRequest(sessionId, event);
  }

  async endSession(sessionId: string): Promise<VoiceSessionEndResponse> {
    if (this.useMockTransport) {
      return {
        sessionId,
        status: "ended",
        endedAt: new Date().toISOString(),
        handoff: {
          nextAction: "stay_on_voice_screen",
          pollSessionStatus: true,
          analysis: {
            route: `/api/sessions/${sessionId}/analysis/evaluate`,
            autoTriggered: false,
            prepared: true,
            itemCount: 0,
          },
        },
      };
    }
    return endVoiceSessionRequest(sessionId);
  }
}

export function createVoiceSessionService(options?: VoiceSessionServiceOptions) {
  return new VoiceSessionService(options);
}

