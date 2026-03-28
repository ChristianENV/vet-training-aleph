import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccessAny } from "@/lib/auth/page-access";
import { getServerEnv } from "@/lib/config/env";
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
  const env = getServerEnv();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Oral assessment"
        description="Guided spoken practice: one prompt at a time, optional support transcript, then finish and run evaluation when you are ready."
      />
      <SessionDetail
        sessionId={sessionId}
        questionGenerationBounds={{
          min: env.sessionGenerationMinQuestions,
          max: env.sessionGenerationMaxQuestions,
        }}
      />
    </div>
  );
}
