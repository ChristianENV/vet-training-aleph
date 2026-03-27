import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccess } from "@/lib/auth/page-access";
import { AnalysisDetail } from "@/modules/analyses/presentation/analysis-detail";

type Props = {
  params: Promise<{ analysisId: string }>;
};

export default async function AnalysisDetailPage(props: Props) {
  const access = await getPageAccess("analyses:view");
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  const { analysisId } = await props.params;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Analysis detail"
        description="Structured scores and narrative feedback for one session analysis run."
      />
      <AnalysisDetail analysisId={analysisId} />
    </div>
  );
}
