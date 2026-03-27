import { requireAnyPermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import {
  getSessionDetailWithProgress,
  SessionsServiceError,
} from "@/modules/sessions/application/session-service";
import type { NextRequest } from "next/server";

function mapServiceError(e: SessionsServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const gate = await requireAnyPermission(["sessions:use", "sessions:view_any"]);
  if (!gate.ok) return gate.response;

  const { sessionId } = await context.params;

  try {
    const { session, progress } = await getSessionDetailWithProgress(gate.user, sessionId);
    return jsonOk({ session, progress });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}
