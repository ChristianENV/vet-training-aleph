import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import { patchUserBodySchema } from "@/modules/users/validators/users";
import {
  setUserActive,
  updateUserRole,
  UsersServiceError,
} from "@/modules/users/application/user-service";
import type { NextRequest } from "next/server";

function mapServiceError(e: UsersServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400, undefined, "VALIDATION_ERROR");
  }

  const parsed = patchUserBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid body", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  const gate =
    parsed.data.role !== undefined
      ? await requirePermission("users:assign_role")
      : await requirePermission("users:deactivate");
  if (!gate.ok) return gate.response;

  try {
    if (parsed.data.role !== undefined) {
      const user = await updateUserRole(gate.user, userId, parsed.data.role);
      return jsonOk({ user });
    }
    if (parsed.data.isActive === undefined) {
      return jsonError("Invalid body", 400, undefined, "VALIDATION_ERROR");
    }
    const user = await setUserActive(gate.user, userId, parsed.data.isActive);
    return jsonOk({ user });
  } catch (e) {
    if (e instanceof UsersServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}
