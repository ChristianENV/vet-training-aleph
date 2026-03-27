import type { UserRole } from "@/generated/prisma/enums";
import { roleHasPermission } from "./permissions";

export type MainNavItem = {
  href: string;
  label: string;
};

/**
 * Primary app navigation — must stay aligned with `rolePermissions` and route-level checks in each page.
 */
export function getVisibleNavItems(role: UserRole): MainNavItem[] {
  const candidates: Array<MainNavItem & { visible: (r: UserRole) => boolean }> = [
    {
      href: "/dashboard",
      label: "Dashboard",
      visible: (r) => roleHasPermission(r, "dashboard:view"),
    },
    {
      href: "/sessions",
      label: "Sessions",
      visible: (r) =>
        roleHasPermission(r, "sessions:use") || roleHasPermission(r, "sessions:view_any"),
    },
    {
      href: "/analyses",
      label: "Analyses",
      visible: (r) => roleHasPermission(r, "analyses:view"),
    },
    {
      href: "/users",
      label: "Users",
      visible: (r) => roleHasPermission(r, "users:list"),
    },
  ];

  return candidates.filter((c) => c.visible(role)).map(({ href, label }) => ({ href, label }));
}
