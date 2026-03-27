import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import { getProgressSummaryForActor } from "@/modules/analyses/application/analyses-read-service";
import { progressSummaryQuerySchema } from "@/modules/analyses/validators/analyses";
import type { NextRequest } from "next/server";

function mapError(e: AnalysisServiceError) {
  return jsonError(e.message, e.status, undefined, e.code as ApiErrorCode | undefined);
}

export async function GET(request: NextRequest) {
  const gate = await requirePermission("analyses:view");
  if (!gate.ok) return gate.response;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = progressSummaryQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid query", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  try {
    const snapshot = await getProgressSummaryForActor(gate.user, parsed.data);
    return jsonOk({ snapshot });
  } catch (e) {
    if (e instanceof AnalysisServiceError) {
      return mapError(e);
    }
    throw e;
  }
}
