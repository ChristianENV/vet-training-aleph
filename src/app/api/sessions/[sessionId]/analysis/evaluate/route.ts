import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import { evaluateCompletedSession } from "@/modules/analyses/application/session-analysis-service";
import type { NextRequest } from "next/server";

function mapError(e: AnalysisServiceError) {
  return jsonError(e.message, e.status, undefined, e.code as ApiErrorCode | undefined);
}

/**
 * POST `/api/sessions/[sessionId]/analysis/evaluate`
 *
 * - **Permission**: `analyses:request` only (trigger). Session ownership enforced in service.
 * - **HTTP**: 200 `{ ok: true, data: { analysis, evaluationRun } }` when the run finishes and a row is persisted.
 *   - `evaluationRun.outcome === "SUCCEEDED"` → model + parse OK (`analysis.status` COMPLETED).
 *   - `evaluationRun.outcome === "FAILED"` → persisted row with `analysis.status` FAILED (see `evaluationRun.message` / `analysis.errorMessage`). Not an HTTP error — client must branch on `evaluationRun.outcome`.
 * - Pre-request errors (validation, conflict, 503) use `{ ok: false, ... }` with non-2xx status.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const gate = await requirePermission("analyses:request");
  if (!gate.ok) return gate.response;

  const { sessionId } = await context.params;

  try {
    const result = await evaluateCompletedSession(gate.user, sessionId);
    return jsonOk(result);
  } catch (e) {
    if (e instanceof AnalysisServiceError) {
      return mapError(e);
    }
    throw e;
  }
}
