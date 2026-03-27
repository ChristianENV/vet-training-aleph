import Link from "next/link";
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
      return "User counts and recent training activity across visible accounts.";
    case "product_owner":
      return "How learners are using training, completions, and evaluation outcomes.";
    case "super_admin":
      return "Aggregated metrics across users, sessions, analyses, and readiness signals.";
    case "developer":
      return "Broad counts for internal review; protected accounts appear only as aggregate numbers.";
    default:
      return "";
  }
}

type Props = {
  data: StaffDashboardData;
};

export function StaffDashboardView({ data }: Props) {
  const { users, sessions, analyses, readiness, recentSessions, learnersWithCompletedSession, variant } =
    data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium">{variantTitle(variant)}</h2>
        <p className="text-muted-foreground text-sm">{variantLead(variant)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Directory users</CardTitle>
            <CardDescription>Excludes protected system accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{users.visibleTotal}</p>
            <p className="text-muted-foreground text-xs">
              Active {users.active} · Inactive {users.inactive}
            </p>
          </CardContent>
        </Card>

        {(variant === "super_admin" || variant === "developer") && users.allAccountsTotal != null ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">All accounts</CardTitle>
              <CardDescription>Including protected</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{users.allAccountsTotal}</p>
              {users.protectedAccounts != null ? (
                <p className="text-muted-foreground text-xs">
                  Protected accounts (count only): {users.protectedAccounts}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessions (7d)</CardTitle>
            <CardDescription>New runs this week</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{sessions.createdLast7Days}</p>
            <p className="text-muted-foreground text-xs">All time: {sessions.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Learners completed</CardTitle>
            <CardDescription>Users with ≥1 completed session</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{learnersWithCompletedSession}</p>
          </CardContent>
        </Card>
      </div>

      {variant === "product_owner" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI evaluation outcomes</CardTitle>
            <CardDescription>Finished evaluations vs failures (all time).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{analyses.byStatus.COMPLETED}</p>
              <p className="text-muted-foreground">Succeeded</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{analyses.byStatus.FAILED}</p>
              <p className="text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sessions by status</CardTitle>
            <CardDescription>All training runs in the database.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(sessions.byStatus).map(([status, n]) => (
              <Badge key={status} variant="secondary">
                {SESSION_STATUS_LABEL[status as keyof typeof SESSION_STATUS_LABEL]}: {n}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analyses by status</CardTitle>
            <CardDescription>Total analyses: {analyses.total}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(analyses.byStatus).map(([status, n]) => (
              <Badge key={status} variant="outline">
                {DASHBOARD_ANALYSIS_STATUS_LABEL[status as keyof typeof DASHBOARD_ANALYSIS_STATUS_LABEL]}:{" "}
                {n}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Readiness (latest per learner)</CardTitle>
          <CardDescription>
            From the most recent snapshot per visible user ({readiness.learnersWithSnapshot} learners).
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Recent session activity</CardTitle>
            <CardDescription>Latest updates from visible accounts.</CardDescription>
          </div>
          <Link href="/sessions" className="text-primary text-sm hover:underline">
            Open sessions
          </Link>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sessions yet.</p>
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
                      <Badge variant="secondary">{SESSION_STATUS_LABEL[row.status]}</Badge>
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

      {variant === "developer" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagnostics</CardTitle>
            <CardDescription>Derived from the same aggregates as above — no extra telemetry.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-1 text-sm">
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
