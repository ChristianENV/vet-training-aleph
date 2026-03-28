import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_INACTIVE"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "SEQUENTIAL_ORDER"
  | "CONFLICT"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "QUESTION_GENERATION_FAILED"
  | "MAX_ATTEMPTS"
  | "FINALIZE_RECOVERABLE"
  | "TRANSCRIPTS_NOT_READY";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function jsonError(
  message: string,
  status: number,
  details?: Record<string, unknown>,
  code?: ApiErrorCode,
): NextResponse {
  return NextResponse.json({ ok: false as const, error: message, code, details }, { status });
}

/** 401 — no valid session (API / BFF). */
export function jsonUnauthorized(message = "Authentication required", details?: Record<string, unknown>): NextResponse {
  return jsonError(message, 401, details, "UNAUTHENTICATED");
}

/** 403 — authenticated but not allowed (RBAC, inactive account, etc.). */
export function jsonForbidden(
  message = "You do not have permission to perform this action",
  code: Extract<ApiErrorCode, "ACCOUNT_INACTIVE" | "FORBIDDEN"> = "FORBIDDEN",
  details?: Record<string, unknown>,
): NextResponse {
  return jsonError(message, 403, details, code);
}
