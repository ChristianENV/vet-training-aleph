import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import { getAnalysisDetailForActor } from "@/modules/analyses/application/analyses-read-service";
import type { NextRequest } from "next/server";

function mapError(e: AnalysisServiceError) {
  return jsonError(e.message, e.status, undefined, e.code as ApiErrorCode | undefined);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ analysisId: string }> },
) {
  const gate = await requirePermission("analyses:view");
  if (!gate.ok) return gate.response;

  const { analysisId } = await context.params;

  try {
    const analysis = await getAnalysisDetailForActor(gate.user, analysisId);
    return jsonOk({ analysis });
  } catch (e) {
    if (e instanceof AnalysisServiceError) {
      return mapError(e);
    }
    throw e;
  }
}
