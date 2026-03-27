import type { UserRole } from "@/generated/prisma/enums";
import { defaultUserListFilter } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export async function listStandardUsers(params: { q?: string; take: number }) {
  return prisma.user.findMany({
    where: {
      ...defaultUserListFilter(),
      ...(params.q
        ? {
            OR: [
              { email: { contains: params.q, mode: "insensitive" } },
              { name: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.take,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isProtectedAccount: true,
      createdAt: true,
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function createUserRecord(data: {
  email: string;
  passwordHash: string;
  name?: string | null;
  role: UserRole;
}) {
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      isProtectedAccount: false,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateUserRoleById(userId: string, role: UserRole) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateUserActiveById(userId: string, isActive: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}
