import { requireAnyPermission } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/http/json";
import { listTemplates } from "@/modules/sessions/application/session-service";

export async function GET() {
  const gate = await requireAnyPermission(["sessions:use", "sessions:view_any"]);
  if (!gate.ok) return gate.response;

  const templates = await listTemplates();
  return jsonOk({ templates });
}
