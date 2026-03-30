import type { ReactNode } from "react";
import Link from "next/link";
import {
  analysisStatusBadgeVariant,
  sessionStatusBadgeVariant,
} from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalysisStatus, SessionStatus } from "@/generated/prisma/enums";
import type { StaffDashboardData } from "@/modules/dashboards/application/dashboard-data-service";
import { SESSION_STATUS_LABEL } from "@/modules/sessions/presentation/session-labels";
import { DASHBOARD_ANALYSIS_STATUS_LABEL, DASHBOARD_READINESS_LABEL } from "./dashboard-labels";

function shortDate(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function variantTitle(variant: StaffDashboardData["variant"]): string {
  switch (variant) {
    case "admin":
      return "Directory & activity";
    case "product_owner":
      return "Training adoption";
    case "super_admin":
      return "Platform overview";
    case "developer":
      return "System overview";
    default:
      return "Overview";
  }
}

function variantLead(variant: StaffDashboardData["variant"]): string {
  switch (variant) {
    case "admin":
      return "Directory and learner cards use non-protected accounts only. Session and analysis totals include every account.";
    case "product_owner":
      return "Adoption metrics follow the user directory (non-protected). Training volume and AI outcomes are platform-wide.";
    case "super_admin":
      return "Directory metrics exclude protected accounts from counts and lists; session and analysis aggregates include all activity system-wide.";
    case "developer":
      return "Directory metrics exclude protected accounts from named counts; platform-wide totals include protected-account activity. Compare directory vs all-accounts where both are shown.";
    default:
      return "";
  }
}

type Props = {
  data: StaffDashboardData;
};

function ScopeSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="max-w-3xl space-y-1.5">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{detail}</p>
      </div>
      {children}
    </section>
  );
}

export function StaffDashboardView({ data }: Props) {
  const {
    users,
    sessions,
    analyses,
    readiness,
    recentSessions,
    learnersWithCompletedSessionVisible,
    learnersWithCompletedSessionAllAccounts,
    variant,
  } = data;

  const showElevatedAccountMetrics = variant === "super_admin" || variant === "developer";

  return (
    <div className="space-y-10">
      <div className="max-w-3xl space-y-2">
        <h2 className="text-brand-navy-900 text-xl font-semibold tracking-tight sm:text-2xl">
          {variantTitle(variant)}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{variantLead(variant)}</p>
      </div>

      <ScopeSection
        title="Directory scope"
        detail="Non-protected accounts only — same visibility as the Users admin list and recent session list. Readiness uses the latest snapshot per directory user."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="bg-muted/10 border-border/90">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Directory users
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Excludes protected system accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-brand-navy-900 text-3xl font-semibold tabular-nums tracking-tight">
                {users.visibleTotal}
              </p>
              <p className="text-muted-foreground text-xs">
                Active {users.active} · Inactive {users.inactive}
              </p>
            </CardContent>
          </Card>

          {showElevatedAccountMetrics && users.allAccountsTotal != null ? (
            <Card className="bg-muted/10 border-border/90">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  All user accounts
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Includes protected (aggregate only)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-brand-navy-900 text-3xl font-semibold tabular-nums tracking-tight">
                  {users.allAccountsTotal}
                </p>
                {users.protectedAccounts != null ? (
                  <p className="text-muted-foreground text-xs">
                    Protected accounts (count only): {users.protectedAccounts}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="bg-muted/10 border-border/90">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Learners with a completion
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Directory users with ≥1 completed session
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-brand-navy-900 text-3xl font-semibold tabular-nums tracking-tight">
                {learnersWithCompletedSessionVisible}
              </p>
              {showElevatedAccountMetrics && learnersWithCompletedSessionAllAccounts != null ? (
                <p className="text-muted-foreground text-xs">
                  All accounts (incl. protected), distinct learners:{" "}
                  {learnersWithCompletedSessionAllAccounts}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
              Readiness (latest per directory learner)
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Most recent snapshot per non-protected user ({readiness.learnersWithSnapshot} learners with
              data).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(readiness.distribution).map(([level, n]) => (
              <Badge key={level} variant="secondary">
                {DASHBOARD_READINESS_LABEL[level as keyof typeof DASHBOARD_READINESS_LABEL]}: {n}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
                Recent session activity
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Latest updates from directory (non-protected) accounts.
              </CardDescription>
            </div>
            <Link
              href="/sessions"
              className="text-primary hover:text-primary-hover shrink-0 text-sm font-medium underline-offset-4 hover:underline"
            >
              Open sessions
            </Link>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-muted-foreground border-border/70 bg-muted/15 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                No sessions yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSessions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[200px] truncate text-sm">{row.user.email}</TableCell>
                      <TableCell>
                        <Link href={`/sessions/${row.id}`} className="hover:underline">
                          {row.title?.trim() || "Untitled"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sessionStatusBadgeVariant(row.status)}>{SESSION_STATUS_LABEL[row.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {shortDate(row.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </ScopeSection>

      <ScopeSection
        title="Platform-wide (all accounts)"
        detail="Every training session and analysis row, including activity from protected accounts."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-muted/10 border-border/90">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                New sessions (rolling 7 days)
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Created in the last seven days, all accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-brand-navy-900 text-3xl font-semibold tabular-nums tracking-tight">
                {sessions.createdLast7Days}
              </p>
              <p className="text-muted-foreground text-xs">All-time session rows: {sessions.total}</p>
            </CardContent>
          </Card>
        </div>

        {variant === "product_owner" ? (
          <Card>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
                AI evaluation outcomes
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Finished vs failed analyses (all time, all accounts). In progress:{" "}
                {analyses.byStatus.PENDING + analyses.byStatus.RUNNING}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-10 text-sm">
              <div>
                <p className="text-brand-navy-900 text-3xl font-semibold tabular-nums tracking-tight">
                  {analyses.byStatus.COMPLETED}
                </p>
                <p className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-wide">
                  Succeeded
                </p>
              </div>
              <div>
                <p className="text-brand-navy-900 text-3xl font-semibold tabular-nums tracking-tight">
                  {analyses.byStatus.FAILED}
                </p>
                <p className="text-muted-foreground mt-1 text-xs font-medium uppercase tracking-wide">Failed</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
                Sessions by status
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                All training runs in the database (every account).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(sessions.byStatus).map(([status, n]) => (
                <Badge key={status} variant={sessionStatusBadgeVariant(status as SessionStatus)}>
                  {SESSION_STATUS_LABEL[status as keyof typeof SESSION_STATUS_LABEL]}: {n}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
                Analyses by status
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Total analysis rows: {analyses.total} (all accounts).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(analyses.byStatus).map(([status, n]) => (
                <Badge key={status} variant={analysisStatusBadgeVariant(status as AnalysisStatus)}>
                  {DASHBOARD_ANALYSIS_STATUS_LABEL[status as keyof typeof DASHBOARD_ANALYSIS_STATUS_LABEL]}:{" "}
                  {n}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScopeSection>

      {variant === "developer" ? (
        <Card className="bg-muted/10 border-border/90">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">Diagnostics</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Derived from the same aggregates as above — no extra telemetry.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            <p>
              Analysis completion rate (completed / total):{" "}
              {analyses.total > 0
                ? `${((analyses.byStatus.COMPLETED / analyses.total) * 100).toFixed(1)}%`
                : "—"}
            </p>
            <p>
              Evaluation failures: {analyses.byStatus.FAILED} · In progress:{" "}
              {analyses.byStatus.PENDING + analyses.byStatus.RUNNING}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
