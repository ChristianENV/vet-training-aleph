import type { UserRole } from "@/generated/prisma/enums";
import { parseApiJsonResponse } from "@/lib/http/api-client";
import type { CreateUserBody } from "@/modules/users/validators/users";
import type { UserListQuery } from "@/modules/users/validators/users";

export type UserListItem = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export async function fetchUsersList(query: UserListQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  params.set("take", String(query.take));
  const res = await fetch(`/api/users?${params.toString()}`, {
    credentials: "include",
  });
  return parseApiJsonResponse<{ users: UserListItem[] }>(res);
}

export async function createUserRequest(body: CreateUserBody) {
  const res = await fetch("/api/users", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiJsonResponse<{ user: UserListItem }>(res);
}

export async function patchUserRoleRequest(userId: string, role: UserRole) {
  const res = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return parseApiJsonResponse<{ user: UserListItem }>(res);
}

export async function patchUserActiveRequest(userId: string, isActive: boolean) {
  const res = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  return parseApiJsonResponse<{ user: UserListItem }>(res);
}
