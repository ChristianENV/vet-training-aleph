import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccessAny } from "@/lib/auth/page-access";
import { VoiceSessionScreen } from "@/modules/voice-session/presentation/voice-session-screen";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function VoiceSessionPage(props: Props) {
  const access = await getPageAccessAny(["sessions:use", "sessions:view_any"]);
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  const { sessionId } = await props.params;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Voice session"
        description="Experimental voice-first session scaffold. The classic wizard flow remains available."
      />
      <VoiceSessionScreen sessionId={sessionId} />
    </div>
  );
}

