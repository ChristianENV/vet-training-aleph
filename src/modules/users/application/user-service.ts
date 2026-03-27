import bcrypt from "bcrypt";
import { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import {
  canAssignRole,
  canAssignRoleOnCreate,
  canChangeUserActiveState,
} from "@/lib/auth/permissions";
import { writeUserAuditLog } from "@/modules/users/infrastructure/user-audit";
import * as repo from "@/modules/users/infrastructure/user-repository";
import type { CreateUserBody, UserListQuery } from "@/modules/users/validators/users";

export class UsersServiceError extends Error {
  constructor(
    public readonly status: 403 | 404 | 409,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "UsersServiceError";
  }
}

export async function listUsers(query: UserListQuery) {
  return repo.listStandardUsers({ q: query.q, take: query.take });
}

export async function createUser(actor: AuthenticatedUser, input: CreateUserBody) {
  if (!canAssignRoleOnCreate(actor.role, input.role)) {
    throw new UsersServiceError(403, "Cannot assign this role", "FORBIDDEN");
  }

  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    throw new UsersServiceError(409, "Email already in use", "CONFLICT");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const created = await repo.createUserRecord({
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
    });

    await writeUserAuditLog({
      actorUserId: actor.id,
      subjectUserId: created.id,
      action: "user.created",
      resourceType: "User",
      resourceId: created.id,
      metadataJson: { email: created.email, role: created.role },
    });

    return created;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new UsersServiceError(409, "Email already in use", "CONFLICT");
    }
    throw e;
  }
}

export async function updateUserRole(actor: AuthenticatedUser, targetId: string, newRole: UserRole) {
  const target = await repo.findUserById(targetId);
  if (!target) {
    throw new UsersServiceError(404, "User not found", "NOT_FOUND");
  }

  if (newRole === UserRole.DEVELOPER && target.role !== UserRole.DEVELOPER) {
    throw new UsersServiceError(403, "Cannot assign DEVELOPER role", "FORBIDDEN");
  }

  if (!canAssignRole(actor.role, target, newRole)) {
    throw new UsersServiceError(403, "Cannot assign this role", "FORBIDDEN");
  }

  if (target.role === newRole) {
    return {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      isActive: target.isActive,
      createdAt: target.createdAt,
    };
  }

  const updated = await repo.updateUserRoleById(targetId, newRole);

  await writeUserAuditLog({
    actorUserId: actor.id,
    subjectUserId: updated.id,
    action: "user.role_changed",
    resourceType: "User",
    resourceId: updated.id,
    metadataJson: { from: target.role, to: newRole },
  });

  return updated;
}

export async function setUserActive(actor: AuthenticatedUser, targetId: string, isActive: boolean) {
  const target = await repo.findUserById(targetId);
  if (!target) {
    throw new UsersServiceError(404, "User not found", "NOT_FOUND");
  }

  if (actor.id === targetId && !isActive) {
    throw new UsersServiceError(403, "Cannot deactivate your own account", "FORBIDDEN");
  }

  if (!canChangeUserActiveState(actor.role, target)) {
    throw new UsersServiceError(403, "Cannot change activation for this user", "FORBIDDEN");
  }

  if (target.isActive === isActive) {
    return {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      isActive: target.isActive,
      createdAt: target.createdAt,
    };
  }

  const updated = await repo.updateUserActiveById(targetId, isActive);

  await writeUserAuditLog({
    actorUserId: actor.id,
    subjectUserId: updated.id,
    action: isActive ? "user.activated" : "user.deactivated",
    resourceType: "User",
    resourceId: updated.id,
    metadataJson: { email: updated.email },
  });

  return updated;
}
