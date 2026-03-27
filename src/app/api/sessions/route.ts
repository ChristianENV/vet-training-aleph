import { roleHasPermission } from "@/lib/auth/permissions";
import { requireAnyPermission, requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import {
  computeSessionProgress,
  createSessionFromTemplate,
  listSessions,
  SessionsServiceError,
} from "@/modules/sessions/application/session-service";
import {
  createSessionBodySchema,
  sessionListQuerySchema,
} from "@/modules/sessions/validators/sessions";
import type { NextRequest } from "next/server";

function mapServiceError(e: SessionsServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

export async function GET(request: NextRequest) {
  const gate = await requireAnyPermission(["sessions:use", "sessions:view_any"]);
  if (!gate.ok) return gate.response;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = sessionListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid query", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  const viewAny = roleHasPermission(gate.user.role, "sessions:view_any");
  const query = {
    ...parsed.data,
    userId: viewAny ? parsed.data.userId : undefined,
  };

  try {
    const sessions = await listSessions(gate.user, query);
    return jsonOk({ sessions });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePermission("sessions:use");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400, undefined, "VALIDATION_ERROR");
  }

  const parsed = createSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid body", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  try {
    const session = await createSessionFromTemplate(gate.user, parsed.data);
    return jsonOk({ session, progress: computeSessionProgress(session) }, { status: 201 });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}
