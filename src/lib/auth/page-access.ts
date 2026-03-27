import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";
import { redirect } from "next/navigation";
import { type Permission, roleHasPermission } from "./permissions";

export type PageAccessDenied = "inactive" | "forbidden";

export type PageAccessOk = {
  kind: "ok";
  role: UserRole;
  email: string;
  name: string | null | undefined;
};

export type PageAccessResult = PageAccessOk | { kind: "denied"; reason: PageAccessDenied };

/**
 * Server-only gate for protected pages. Unauthenticated users are redirected to `/login`.
 */
export async function getPageAccess(permission: Permission): Promise<PageAccessResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!session.user.isActive) {
    return { kind: "denied", reason: "inactive" };
  }
  if (!roleHasPermission(session.user.role, permission)) {
    return { kind: "denied", reason: "forbidden" };
  }
  return {
    kind: "ok",
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
  };
}

export async function getPageAccessAny(permissions: Permission[]): Promise<PageAccessResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!session.user.isActive) {
    return { kind: "denied", reason: "inactive" };
  }
  const allowed = permissions.some((p) => roleHasPermission(session.user.role, p));
  if (!allowed) {
    return { kind: "denied", reason: "forbidden" };
  }
  return {
    kind: "ok",
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
  };
}
