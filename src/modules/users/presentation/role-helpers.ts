import { UserRole } from "@/generated/prisma/enums";
import { canAssignRole, canAssignRoleOnCreate } from "@/lib/auth/permissions";

export function rolesForCreate(actorRole: UserRole): UserRole[] {
  return (Object.values(UserRole) as UserRole[]).filter((r) => canAssignRoleOnCreate(actorRole, r));
}

export function rolesForReassign(
  actorRole: UserRole,
  target: { role: UserRole; isProtectedAccount: boolean },
): UserRole[] {
  return (Object.values(UserRole) as UserRole[]).filter((r) => {
    if (r === UserRole.DEVELOPER && target.role !== UserRole.DEVELOPER) return false;
    return canAssignRole(actorRole, target, r);
  });
}
