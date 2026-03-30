import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import {
  computeSessionProgress,
  SessionsServiceError,
} from "@/modules/sessions/application/session-service";
import { resumePostFinalizeTranscription } from "@/modules/sessions/application/session-finalize-service";
import type { NextRequest } from "next/server";

function mapSessionsError(e: SessionsServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

function mapAnalysisError(e: AnalysisServiceError) {
  return jsonError(e.message, e.status, undefined, e.code as ApiErrorCode | undefined);
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const gate = await requirePermission("sessions:use");
  if (!gate.ok) return gate.response;

  const { sessionId } = await context.params;

  try {
    const {
      session,
      evaluation,
      transcriptionFailed,
      transcriptionFailureMessage,
    } = await resumePostFinalizeTranscription(gate.user, sessionId);
    return jsonOk({
      session,
      progress: computeSessionProgress(session),
      evaluation,
      transcriptionFailed,
      transcriptionFailureMessage,
    });
  } catch (e) {
    if (e instanceof SessionsServiceError) {
      return mapSessionsError(e);
    }
    if (e instanceof AnalysisServiceError) {
      return mapAnalysisError(e);
    }
    throw e;
  }
}
