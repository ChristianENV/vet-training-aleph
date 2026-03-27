import { auth } from "@/auth";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { UserRole } from "@/generated/prisma/enums";
import { getPageAccess } from "@/lib/auth/page-access";
import {
  getStaffDashboardData,
  getUserDashboardData,
  staffVariantForRole,
} from "@/modules/dashboards/application/dashboard-data-service";
import { StaffDashboardView, UserDashboardView } from "@/modules/dashboards/presentation";
import { redirect } from "next/navigation";

function dashboardDescription(role: UserRole): string {
  switch (role) {
    case UserRole.USER:
      return "Your next steps, recent sessions, latest analysis, and readiness snapshot.";
    case UserRole.ADMIN:
      return "Directory scale, session activity, analyses, and readiness across visible learners.";
    case UserRole.PRODUCT_OWNER:
      return "Adoption and training outcomes: usage, completions, evaluations, and readiness mix.";
    case UserRole.SUPER_ADMIN:
      return "Cross-cutting counts for users, sessions, analyses, and progress signals.";
    case UserRole.DEVELOPER:
      return "Aggregated system metrics and lightweight diagnostics from live data.";
    default:
      return "Dashboard";
  }
}

export default async function DashboardPage() {
  const access = await getPageAccess("dashboard:view");
  if (access.kind === "denied") {
    return <AccessDenied reason={access.reason} />;
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  if (access.role === UserRole.USER) {
    const data = await getUserDashboardData(userId);
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader title="Dashboard" description={dashboardDescription(access.role)} />
        <UserDashboardView data={data} />
      </div>
    );
  }

  const variant = staffVariantForRole(access.role);
  if (!variant) {
    return <AccessDenied reason="forbidden" />;
  }

  const staffData = await getStaffDashboardData(variant);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title="Dashboard" description={dashboardDescription(access.role)} />
      <StaffDashboardView data={staffData} />
    </div>
  );
}
