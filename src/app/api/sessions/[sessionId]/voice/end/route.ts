import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { SessionsServiceError } from "@/modules/sessions/application/session-service";
import { endVoiceBackbone } from "@/modules/voice-session/application/voice-session-backbone-service";
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
    const { session, analysisHandoff, idempotentReplay } = await endVoiceBackbone(gate.user, sessionId);
    return jsonOk({
      sessionId,
      status: "ended" as const,
      idempotentReplay,
      endedAt: new Date().toISOString(),
      session: {
        id: session.id,
        status: session.status,
      },
      handoff: {
        nextAction: "open_classic_session" as const,
        classicSessionUrl: `/sessions/${sessionId}`,
        analysis: {
          route: analysisHandoff.route,
          autoTriggered: analysisHandoff.autoTriggered,
          prepared: analysisHandoff.prepared,
          itemCount: analysisHandoff.itemCount,
          analysisId: analysisHandoff.analysisId,
          outcome: analysisHandoff.outcome,
        },
        pollSessionStatus: true,
      },
    });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}

