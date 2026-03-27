/**
 * Browser fetch helpers for BFF JSON routes (`{ ok, data }` / `{ ok, error, code? }`).
 * Server route builders live in `./json.ts`.
 */

export type ApiErrorEnvelope = {
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function parseApiJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiRequestError(`Server returned non-JSON (${res.status})`, res.status);
  }

  if (typeof parsed !== "object" || parsed === null || !("ok" in parsed)) {
    throw new ApiRequestError(`Unexpected response (${res.status})`, res.status);
  }

  const body = parsed as {
    ok: unknown;
    data?: unknown;
    error?: unknown;
    code?: unknown;
    details?: unknown;
  };

  if (!res.ok || body.ok !== true) {
    throw new ApiRequestError(
      typeof body.error === "string" ? body.error : `Request failed (${res.status})`,
      res.status,
      typeof body.code === "string" ? body.code : undefined,
      body.details as Record<string, unknown> | undefined,
    );
  }

  return body.data as T;
}
