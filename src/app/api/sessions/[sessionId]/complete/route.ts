import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import {
  completeSession,
  computeSessionProgress,
  SessionsServiceError,
} from "@/modules/sessions/application/session-service";
import { completeSessionBodySchema } from "@/modules/sessions/validators/sessions";
import type { NextRequest } from "next/server";

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

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return jsonError("Invalid JSON body", 400, undefined, "VALIDATION_ERROR");
  }

  const parsed = completeSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid body", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  try {
    const session = await completeSession(gate.user, sessionId);
    if (!session) {
      return jsonError("Session not found", 404, undefined, "NOT_FOUND");
    }
    return jsonOk({ session, progress: computeSessionProgress(session) });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}
