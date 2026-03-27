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
import type { UserDashboardData } from "@/modules/dashboards/application/dashboard-data-service";
import { SESSION_STATUS_LABEL } from "@/modules/sessions/presentation/session-labels";
import { DASHBOARD_ANALYSIS_STATUS_LABEL, DASHBOARD_READINESS_LABEL } from "./dashboard-labels";

function shortDate(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function nextActionCopy(action: UserDashboardData["nextAction"]): { title: string; detail: string } {
  switch (action.kind) {
    case "start_first_session":
      return {
        title: "Start your first session",
        detail: "Pick a template and open a training run from the sessions area.",
      };
    case "continue_session":
      return {
        title: action.headline,
        detail:
          "Open the session to continue. Mark it complete when you are done, then run AI evaluation if needed.",
      };
    case "evaluation_pending":
      return {
        title: "AI evaluation in progress",
        detail: "Open the session to see status or wait for the run to finish.",
      };
    case "run_evaluation":
      return {
        title: "Run AI evaluation",
        detail: "Your session is complete — request feedback from the session page.",
      };
    case "review_analysis":
      return {
        title: "Review your latest analysis",
        detail: "See scores and feedback from your most recent evaluation.",
      };
    case "review_analyses":
      return {
        title: "Browse your analyses",
        detail: "Review past evaluations and progress from the analyses list.",
      };
  }
}

type Props = {
  data: UserDashboardData;
};

const BUTTON_SM_CLASS =
  "group/button inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-transparent bg-primary px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-primary-foreground transition-all outline-none select-none hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

const BUTTON_OUTLINE_SM_CLASS =
  "group/button inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50";

export function UserDashboardView({ data }: Props) {
  const { recentSessions, latestAnalysis, latestProgress, nextAction } = data;
  const na = nextActionCopy(nextAction);

  return (
    <div className="space-y-8">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">What to do next</CardTitle>
          <CardDescription>{na.detail}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">{na.title}</p>
          <Link href={nextAction.href} className={BUTTON_SM_CLASS}>
            Continue
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent sessions</CardTitle>
            <CardDescription>Your latest training runs, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sessions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/sessions/${s.id}`} className="font-medium hover:underline">
                          {s.title?.trim() || "Untitled session"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{SESSION_STATUS_LABEL[s.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {shortDate(s.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest analysis</CardTitle>
            <CardDescription>Most recent evaluation linked to your sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!latestAnalysis ? (
              <p className="text-muted-foreground">No analyses yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {DASHBOARD_ANALYSIS_STATUS_LABEL[latestAnalysis.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {latestAnalysis.completedAt
                      ? shortDate(latestAnalysis.completedAt)
                      : shortDate(latestAnalysis.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-2">
                  {latestAnalysis.summary?.trim() || "No summary yet."}
                </p>
                <Link
                  href={`/analyses/${latestAnalysis.id}`}
                  className={BUTTON_OUTLINE_SM_CLASS}
                >
                  Open analysis
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress & readiness</CardTitle>
          <CardDescription>
            From your latest progress snapshot (updated when an evaluation completes).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!latestProgress ? (
            <p className="text-muted-foreground">
              No snapshot yet. Complete a session and run AI evaluation to record readiness.
            </p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Readiness: </span>
                <Badge>{DASHBOARD_READINESS_LABEL[latestProgress.readiness]}</Badge>
              </p>
              <p className="text-muted-foreground text-xs">
                Captured {shortDate(latestProgress.capturedAt)}
              </p>
              <Link href="/analyses" className={BUTTON_OUTLINE_SM_CLASS}>
                View analyses & progress
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
