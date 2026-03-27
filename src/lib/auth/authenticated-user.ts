import type { Session } from "next-auth";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Minimal user shape for services and route handlers after auth checks.
 * Built from Auth.js session — keep in sync with JWT/session callbacks in `src/auth.ts`.
 */
export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  isProtectedAccount: boolean;
  isActive: boolean;
};

export function sessionUserToAuthenticatedUser(session: Session): AuthenticatedUser | null {
  const u = session.user;
  if (!u?.id || !u.email) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    isProtectedAccount: u.isProtectedAccount,
    isActive: u.isActive,
  };
}
