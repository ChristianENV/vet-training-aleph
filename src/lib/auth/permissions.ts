import { UserRole } from "@/generated/prisma/enums";

export { UserRole };

/**
 * Coarse RBAC permissions for route handlers and application services.
 * Fine-grained rules for protected users (e.g. developer) use the helpers below.
 */
export type Permission =
  | "users:list"
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:deactivate"
  | "users:delete"
  | "users:assign_role"
  | "sessions:use"
  | "sessions:view_any"
  | "analyses:view"
  | "analyses:request"
  | "dashboard:view"
  | "dashboard:product"
  | "audit:view"
  | "platform:settings";

const ALL_PERMISSIONS: readonly Permission[] = [
  "users:list",
  "users:read",
  "users:create",
  "users:update",
  "users:deactivate",
  "users:delete",
  "users:assign_role",
  "sessions:use",
  "sessions:view_any",
  "analyses:view",
  "analyses:request",
  "dashboard:view",
  "dashboard:product",
  "audit:view",
  "platform:settings",
];

function allPermissions(): ReadonlySet<Permission> {
  return new Set(ALL_PERMISSIONS);
}

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  USER: new Set([
    "sessions:use",
    "analyses:view",
    "analyses:request",
    "dashboard:view",
  ]),
  PRODUCT_OWNER: new Set([
    "users:list",
    "users:read",
    "sessions:view_any",
    "analyses:view",
    "analyses:request",
    "dashboard:view",
    "dashboard:product",
    "audit:view",
  ]),
  ADMIN: new Set([
    "users:list",
    "users:read",
    "users:create",
    "users:update",
    "users:deactivate",
    "users:delete",
    "users:assign_role",
    "sessions:use",
    "sessions:view_any",
    "analyses:view",
    "analyses:request",
    "dashboard:view",
    "audit:view",
  ]),
  SUPER_ADMIN: allPermissions(),
  DEVELOPER: allPermissions(),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.has(permission) ?? false;
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!roleHasPermission(role, permission)) {
    throw new Error(`Missing permission ${permission} for role ${role}`);
  }
}

type ProtectedUserFields = {
  isProtectedAccount: boolean;
  role: UserRole;
};

/** Standard listings: exclude `isProtectedAccount` in queries; this helper documents intent. */
export function defaultUserListFilter(): { isProtectedAccount: false } {
  return { isProtectedAccount: false };
}

/** Protected accounts cannot be deleted (developer + any future bootstrap users). */
export function canDeleteUser(actorRole: UserRole, target: ProtectedUserFields): boolean {
  if (target.isProtectedAccount) return false;
  return roleHasPermission(actorRole, "users:delete");
}

/** Protected accounts cannot be deactivated. */
export function canDeactivateUser(actorRole: UserRole, target: ProtectedUserFields): boolean {
  if (target.isProtectedAccount) return false;
  return roleHasPermission(actorRole, "users:deactivate");
}

/**
 * Toggle `isActive` for non-protected users only (activate or deactivate).
 * Uses `users:deactivate` permission for both directions in the MVP.
 */
export function canChangeUserActiveState(actorRole: UserRole, target: ProtectedUserFields): boolean {
  if (target.isProtectedAccount) return false;
  return roleHasPermission(actorRole, "users:deactivate");
}

/**
 * Roles an actor may assign when **creating** a user. Never allows DEVELOPER via API; SUPER_ADMIN only for top roles.
 */
export function canAssignRoleOnCreate(actorRole: UserRole, newRole: UserRole): boolean {
  if (!roleHasPermission(actorRole, "users:create")) return false;
  if (newRole === UserRole.DEVELOPER) return false;
  if (newRole === UserRole.SUPER_ADMIN) {
    return actorRole === UserRole.SUPER_ADMIN || actorRole === UserRole.DEVELOPER;
  }
  return true;
}

/**
 * Role reassignment: normal admins cannot change protected users.
 * Seeded developer: role is fixed (cannot be reassigned).
 * Other protected accounts: only SUPER_ADMIN may change role.
 */
export function canAssignRole(
  actorRole: UserRole,
  target: ProtectedUserFields,
  newRole: UserRole,
): boolean {
  if (!roleHasPermission(actorRole, "users:assign_role")) return false;

  if (target.role === UserRole.DEVELOPER && target.isProtectedAccount) {
    return newRole === UserRole.DEVELOPER;
  }

  if (target.isProtectedAccount && newRole !== target.role) {
    return actorRole === UserRole.SUPER_ADMIN;
  }

  return true;
}

/**
 * Whether `actor` may update another user's non-role fields (name, profile, isActive, …).
 * Admins cannot mutate protected developer accounts; SUPER_ADMIN can.
 */
export function canAdminUpdateUser(actorRole: UserRole, target: ProtectedUserFields): boolean {
  if (target.isProtectedAccount && target.role === UserRole.DEVELOPER) {
    return actorRole === UserRole.SUPER_ADMIN || actorRole === UserRole.DEVELOPER;
  }
  if (target.isProtectedAccount) {
    return actorRole === UserRole.SUPER_ADMIN;
  }
  return roleHasPermission(actorRole, "users:update");
}
