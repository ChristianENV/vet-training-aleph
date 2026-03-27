import { roleHasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import { listAnalysesForActor } from "@/modules/analyses/application/analyses-read-service";
import { analysisListQuerySchema } from "@/modules/analyses/validators/analyses";
import type { NextRequest } from "next/server";

function mapError(e: AnalysisServiceError) {
  return jsonError(e.message, e.status, undefined, e.code as ApiErrorCode | undefined);
}

export async function GET(request: NextRequest) {
  const gate = await requirePermission("analyses:view");
  if (!gate.ok) return gate.response;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = analysisListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid query", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  const viewAny = roleHasPermission(gate.user.role, "sessions:view_any");
  const query = {
    ...parsed.data,
    userId: viewAny ? parsed.data.userId : undefined,
  };

  try {
    const analyses = await listAnalysesForActor(gate.user, query);
    return jsonOk({ analyses });
  } catch (e) {
    if (e instanceof AnalysisServiceError) {
      return mapError(e);
    }
    throw e;
  }
}
