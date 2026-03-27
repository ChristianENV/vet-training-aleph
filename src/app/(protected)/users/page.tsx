import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { getPageAccess } from "@/lib/auth/page-access";
import { UsersDirectory } from "@/modules/users/presentation/users-directory";

export default async function UsersPage() {
  const access = await getPageAccess("users:list");
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Users"
        description="Directory and administration for learner and staff accounts. Protected system accounts are excluded from standard listings."
      />
      <UsersDirectory actorRole={access.role} />
    </div>
  );
}
