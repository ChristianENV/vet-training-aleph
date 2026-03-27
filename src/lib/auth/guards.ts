import { auth } from "@/auth";
import type { Session } from "next-auth";
import type { UserRole } from "@/generated/prisma/enums";
import { jsonForbidden, jsonUnauthorized } from "@/lib/http/json";
import type { ApiErrorCode } from "@/lib/http/json";
import { NextResponse } from "next/server";
import { sessionUserToAuthenticatedUser, type AuthenticatedUser } from "./authenticated-user";
import { type Permission, roleHasPermission } from "./permissions";

export type AuthGuardFailure = { ok: false; response: NextResponse };
export type AuthGuardSuccess = { ok: true; session: Session; user: AuthenticatedUser };
export type AuthGuardResult = AuthGuardSuccess | AuthGuardFailure;

type InternalFailure =
  | { kind: "unauthenticated"; message: string; details?: Record<string, unknown> }
  | { kind: "inactive"; message: string }
  | { kind: "forbidden"; message: string; details?: Record<string, unknown> };

function toResponse(f: InternalFailure): NextResponse {
  if (f.kind === "unauthenticated") {
    return jsonUnauthorized(f.message, f.details);
  }
  if (f.kind === "inactive") {
    return jsonForbidden(f.message, "ACCOUNT_INACTIVE");
  }
  return jsonForbidden(f.message, "FORBIDDEN", f.details);
}

async function resolveSessionUser(): Promise<
  { ok: true; session: Session; user: AuthenticatedUser } | { ok: false; failure: InternalFailure }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, failure: { kind: "unauthenticated", message: "Authentication required" } };
  }
  const user = sessionUserToAuthenticatedUser(session);
  if (!user) {
    return {
      ok: false,
      failure: {
        kind: "unauthenticated",
        message: "Invalid session: missing user claims",
      },
    };
  }
  return { ok: true, session, user };
}

async function resolveActiveUser(): Promise<
  { ok: true; session: Session; user: AuthenticatedUser } | { ok: false; failure: InternalFailure }
> {
  const base = await resolveSessionUser();
  if (!base.ok) return base;
  if (!base.user.isActive) {
    return { ok: false, failure: { kind: "inactive", message: "Account is inactive" } };
  }
  return base;
}

function fail(f: InternalFailure): AuthGuardFailure {
  return { ok: false, response: toResponse(f) };
}

/**
 * Valid session with id, email, role, isProtectedAccount, isActive (from JWT/session).
 */
export async function requireAuth(): Promise<AuthGuardResult> {
  const r = await resolveSessionUser();
  if (!r.ok) return fail(r.failure);
  return { ok: true, session: r.session, user: r.user };
}

export async function requireActiveUser(): Promise<AuthGuardResult> {
  const r = await resolveActiveUser();
  if (!r.ok) return fail(r.failure);
  return { ok: true, session: r.session, user: r.user };
}

export async function requirePermission(permission: Permission): Promise<AuthGuardResult> {
  const r = await resolveActiveUser();
  if (!r.ok) return fail(r.failure);
  if (!roleHasPermission(r.user.role, permission)) {
    return fail({
      kind: "forbidden",
      message: `Missing permission: ${permission}`,
      details: { permission },
    });
  }
  return { ok: true, session: r.session, user: r.user };
}

export async function requireAnyPermission(permissions: Permission[]): Promise<AuthGuardResult> {
  const r = await resolveActiveUser();
  if (!r.ok) return fail(r.failure);
  const allowed = permissions.some((p) => roleHasPermission(r.user.role, p));
  if (!allowed) {
    return fail({
      kind: "forbidden",
      message: "Insufficient permissions",
      details: { requiredAny: permissions },
    });
  }
  return { ok: true, session: r.session, user: r.user };
}

export async function requireAnyRole(roles: UserRole[]): Promise<AuthGuardResult> {
  const r = await resolveActiveUser();
  if (!r.ok) return fail(r.failure);
  if (!roles.includes(r.user.role)) {
    return fail({
      kind: "forbidden",
      message: "Insufficient role",
      details: { requiredAnyRole: roles },
    });
  }
  return { ok: true, session: r.session, user: r.user };
}

/** Map internal failure to `ApiErrorCode` for thrown errors. */
function failureToCode(f: InternalFailure): ApiErrorCode {
  if (f.kind === "unauthenticated") return "UNAUTHENTICATED";
  if (f.kind === "inactive") return "ACCOUNT_INACTIVE";
  return "FORBIDDEN";
}

export class AuthorizationError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getAuthenticatedUserOrThrow(): Promise<AuthenticatedUser> {
  const r = await resolveActiveUser();
  if (!r.ok) {
    const f = r.failure;
    throw new AuthorizationError(failureToCode(f), f.message, getDetails(f));
  }
  return r.user;
}

export async function requirePermissionOrThrowAny(permissions: Permission[]): Promise<AuthenticatedUser> {
  const r = await resolveActiveUser();
  if (!r.ok) {
    const f = r.failure;
    throw new AuthorizationError(failureToCode(f), f.message, getDetails(f));
  }
  const allowed = permissions.some((p) => roleHasPermission(r.user.role, p));
  if (!allowed) {
    throw new AuthorizationError("FORBIDDEN", "Insufficient permissions", { requiredAny: permissions });
  }
  return r.user;
}

function getDetails(f: InternalFailure): Record<string, unknown> | undefined {
  if (f.kind === "unauthenticated") return f.details;
  if (f.kind === "forbidden") return f.details;
  return undefined;
}

export async function requirePermissionOrThrow(permission: Permission): Promise<AuthenticatedUser> {
  const r = await resolveActiveUser();
  if (!r.ok) {
    const f = r.failure;
    throw new AuthorizationError(failureToCode(f), f.message, getDetails(f));
  }
  if (!roleHasPermission(r.user.role, permission)) {
    throw new AuthorizationError("FORBIDDEN", `Missing permission: ${permission}`, { permission });
  }
  return r.user;
}

