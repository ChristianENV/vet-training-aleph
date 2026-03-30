import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";
import {
  computeSessionProgress,
  SessionsServiceError,
} from "@/modules/sessions/application/session-service";
import { readFormDataBinaryPart } from "@/lib/http/form-data-binary";
import { finalizeSessionWithUploads } from "@/modules/sessions/application/session-finalize-service";
import type { NextRequest } from "next/server";

function mapSessionsError(e: SessionsServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

function mapAnalysisError(e: AnalysisServiceError) {
  return jsonError(e.message, e.status, undefined, e.code as ApiErrorCode | undefined);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const gate = await requirePermission("sessions:use");
  if (!gate.ok) return gate.response;

  const { sessionId } = await context.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid multipart body", 400, undefined, "VALIDATION_ERROR");
  }

  const uploads = new Map<string, { buffer: Buffer; contentType: string }>();
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("audio_")) continue;
    const qid = k.slice("audio_".length);
    if (!qid) continue;
    const parsed = await readFormDataBinaryPart(v);
    if (parsed) uploads.set(qid, parsed);
  }

  try {
    const {
      session,
      evaluation,
      transcriptionFailed,
      transcriptionFailureMessage,
    } = await finalizeSessionWithUploads(gate.user, sessionId, uploads);
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
