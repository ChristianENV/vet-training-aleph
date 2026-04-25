import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { SessionsServiceError } from "@/modules/sessions/application/session-service";
import { connectVoiceBackbone } from "@/modules/voice-session/application/voice-session-backbone-service";
import type { NextRequest } from "next/server";

function mapServiceError(e: SessionsServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const gate = await requirePermission("sessions:use");
  if (!gate.ok) return gate.response;

  const { sessionId } = await context.params;
  try {
    const { session, connectionId, turns, events, bootstrap } = await connectVoiceBackbone(
      gate.user,
      sessionId,
    );
    return jsonOk({
      sessionId,
      connectionId,
      status: "bootstrap_ready" as const,
      transport: {
        mode: "webrtc" as const,
        eventsUrl: `/api/sessions/${sessionId}/voice/events`,
        heartbeatIntervalMs: 15000,
      },
      capabilities: {
        acceptsAudioStream: true,
        acceptsTextEvents: true,
        serverTranscription: "partial" as const,
      },
      session: {
        id: session.id,
        status: session.status,
      },
      handoff: {
        endSessionUrl: `/api/sessions/${sessionId}/voice/end`,
      },
      bootstrap: {
        ephemeralKey: bootstrap.clientSecret,
        model: bootstrap.model,
        voice: bootstrap.voice,
        expiresAt: bootstrap.expiresAt,
        instructions: bootstrap.instructions,
      },
      history: {
        turns: turns.map((t) => ({
          id: t.id,
          speaker: t.speaker,
          text: t.text,
          clientTurnId: t.clientTurnId,
          sourceClientEventId: t.sourceClientEventId,
          createdAt: t.createdAt.toISOString(),
          sequence: t.sequence,
          isFinal: t.isFinal,
        })),
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          clientEventId: e.clientEventId,
          payloadJson: e.payloadJson,
          createdAt: e.createdAt.toISOString(),
          sequence: e.sequence,
        })),
      },
    });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}

