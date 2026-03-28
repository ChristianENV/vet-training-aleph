import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccessAny } from "@/lib/auth/page-access";
import { SessionsHome } from "@/modules/sessions/presentation/sessions-home";

export default async function SessionsPage() {
  const access = await getPageAccessAny(["sessions:use", "sessions:view_any"]);
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Training sessions"
        description="Create a run from a template, start it, then answer each question in order using a transcript (recommended). Complete the run before AI evaluation."
      />
      <SessionsHome actorRole={access.role} />
    </div>
  );
}
