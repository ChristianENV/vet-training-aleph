import {
  createUserBodySchema,
  userListQuerySchema,
} from "@/modules/users/validators/users";
import {
  createUser,
  listUsers,
  UsersServiceError,
} from "@/modules/users/application/user-service";
import { requirePermission } from "@/lib/auth/guards";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/http/json";
import type { NextRequest } from "next/server";

function mapServiceError(e: UsersServiceError) {
  const code = (e.code ?? "FORBIDDEN") as ApiErrorCode;
  return jsonError(e.message, e.status, undefined, code);
}

export async function GET(request: NextRequest) {
  const gate = await requirePermission("users:list");
  if (!gate.ok) return gate.response;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  if (raw.q === "") delete raw.q;

  const parsed = userListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid query", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  const users = await listUsers(parsed.data);
  return jsonOk({ users });
}

export async function POST(request: NextRequest) {
  const gate = await requirePermission("users:create");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400, undefined, "VALIDATION_ERROR");
  }

  const parsed = createUserBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid body", 400, { issues: parsed.error.flatten() }, "VALIDATION_ERROR");
  }

  try {
    const user = await createUser(gate.user, parsed.data);
    return jsonOk({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof UsersServiceError) {
      return mapServiceError(e);
    }
    throw e;
  }
}
