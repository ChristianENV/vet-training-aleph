import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccess } from "@/lib/auth/page-access";
import { AnalysesList } from "@/modules/analyses/presentation/analyses-list";

export default async function AnalysesPage() {
  const access = await getPageAccess("analyses:view");
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Analyses"
        description="AI session evaluations and your rolling progress snapshot. Open a row for full scores and feedback."
      />
      <AnalysesList />
    </div>
  );
}
