import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { SessionsServiceError } from "@/modules/sessions/application/session-service";
import { persistVoiceEvent } from "@/modules/voice-session/application/voice-session-backbone-service";
import { z } from "zod";
import type { NextRequest } from "next/server";

const voiceEventSchema = z.object({
  eventId: z.string().trim().min(3).max(120),
  type: z
    .enum([
      "session.connected",
      "session.listening",
      "user.speaking.started",
      "user.speaking.stopped",
      "assistant.speaking.started",
      "assistant.speaking.stopped",
      "transcript.interim",
      "transcript.final",
      "session.ending",
    ])
    .or(z.string().trim().min(1).max(120)),
  occurredAt: z.string().trim().min(1).max(120),
  connectionId: z.string().trim().min(3).max(160).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  turn: z
    .object({
      speaker: z.enum(["assistant", "user", "system"]),
      text: z.string().trim().min(1).max(32000),
      isFinal: z.boolean().optional(),
      clientTurnId: z.string().trim().min(3).max(120).optional(),
    })
    .optional(),
});

function mapServiceError(e: SessionsServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const gate = await requirePermission("sessions:use");
  if (!gate.ok) return gate.response;

  const { sessionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400, undefined, "VALIDATION_ERROR");
  }

  const parsed = voiceEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid body", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  try {
    const { savedEvent, savedTurn, deduped } = await persistVoiceEvent(
      gate.user,
      sessionId,
      {
        type: parsed.data.type,
        clientEventId: parsed.data.eventId,
        payload: parsed.data.payload ?? {},
      },
      parsed.data.turn
        ? {
            speaker: parsed.data.turn.speaker,
            text: parsed.data.turn.text,
            isFinal: parsed.data.turn.isFinal ?? true,
            clientTurnId: parsed.data.turn.clientTurnId,
          }
        : undefined,
    );
    return jsonOk({
      acknowledged: true as const,
      duplicate: deduped,
      eventId: parsed.data.eventId,
      eventType: parsed.data.type,
      acceptedAt: savedEvent.createdAt.toISOString(),
      sequence: savedEvent.sequence,
      persistedEvent: {
        id: savedEvent.id,
        type: savedEvent.type,
        clientEventId: savedEvent.clientEventId,
        payloadJson: savedEvent.payloadJson,
        createdAt: savedEvent.createdAt.toISOString(),
        sequence: savedEvent.sequence,
      },
      persistedTurn: savedTurn
        ? {
            id: savedTurn.id,
            speaker: savedTurn.speaker,
            text: savedTurn.text,
            clientTurnId: savedTurn.clientTurnId,
            sourceClientEventId: savedTurn.sourceClientEventId,
            createdAt: savedTurn.createdAt.toISOString(),
            sequence: savedTurn.sequence,
            isFinal: savedTurn.isFinal,
          }
        : null,
    });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}

