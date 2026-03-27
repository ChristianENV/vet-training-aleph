import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccessAny } from "@/lib/auth/page-access";
import { SessionDetail } from "@/modules/sessions/presentation/session-detail";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage(props: Props) {
  const access = await getPageAccessAny(["sessions:use", "sessions:view_any"]);
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  const { sessionId } = await props.params;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Training session"
        description="Answer each template question, then complete the session to run AI evaluation."
      />
      <SessionDetail sessionId={sessionId} />
    </div>
  );
}
