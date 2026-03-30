"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { LoadingState } from "@/components/shared/loading-state";
import { QueryErrorHint } from "@/components/shared/query-status";
import { fetchAnalysesList, fetchProgressSummary } from "./analyses-api";
import { AnalysisStatusBadge } from "@/components/shared/status-badges";
import { readinessLabelFromString } from "./analysis-labels";

type MetricsV1 = {
  version: 1;
  totalCompletedAnalyses: number;
  averageOverallScore: number;
  lastOverallScore: number;
  lastAnalysisId: string;
  lastSessionId: string;
  lastSessionTitle: string | null;
  recentOverallScores: number[];
};

function isMetricsV1(x: unknown): x is MetricsV1 {
  return (
    !!x &&
    typeof x === "object" &&
    (x as MetricsV1).version === 1 &&
    typeof (x as MetricsV1).totalCompletedAnalyses === "number"
  );
}

export function AnalysesList() {
  const listQuery = useQuery({
    queryKey: ["analyses-list"],
    queryFn: () => fetchAnalysesList({ take: 50 }),
  });

  const progressQuery = useQuery({
    queryKey: ["progress-summary"],
    queryFn: () => fetchProgressSummary(),
  });

  const snapshot = progressQuery.data?.snapshot ?? null;
  const metrics = snapshot?.metricsJson;
  const m = isMetricsV1(metrics) ? metrics : null;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress snapshot</CardTitle>
          <CardDescription>
            Updated when a session analysis reaches <strong>Completed</strong> (not on failed runs).
            Readiness reflects your latest successful evaluation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {progressQuery.isLoading ? (
            <LoadingState
              embedded
              title="Loading progress snapshot"
              hint="This usually takes just a few seconds."
              size="sm"
            />
          ) : progressQuery.isError ? (
            <QueryErrorHint>
              {progressQuery.error instanceof Error
                ? progressQuery.error.message
                : "Could not load progress"}
            </QueryErrorHint>
          ) : !snapshot ? (
            <p className="text-muted-foreground">
              No progress snapshot yet. Complete a session, run AI evaluation successfully, and your
              summary will appear here.
            </p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Readiness: </span>
                <span className="font-medium">{readinessLabelFromString(snapshot.readiness)}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-muted-foreground">
                  {new Date(snapshot.capturedAt).toLocaleString()}
                </span>
              </p>
              {m ? (
                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                  <li>Completed analyses: {m.totalCompletedAnalyses}</li>
                  <li>Average overall score: {m.averageOverallScore}</li>
                  <li>Last overall score: {m.lastOverallScore}</li>
                  {m.recentOverallScores.length ? (
                    <li>Recent scores (newest first): {m.recentOverallScores.join(", ")}</li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-muted-foreground">Metrics format not recognized.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Analysis history</h2>
        {listQuery.isLoading ? (
          <LoadingState
            layout="inline"
            title="Loading analyses"
            description="Fetching your evaluation history."
            hint="This usually takes just a few seconds."
            size="sm"
          />
        ) : listQuery.isError ? (
          <QueryErrorHint>
            {listQuery.error instanceof Error ? listQuery.error.message : "Failed to load"}
          </QueryErrorHint>
        ) : listQuery.data?.analyses.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No analyses yet</CardTitle>
              <CardDescription>
                Complete a training session (transcript answers), then run evaluation from the session detail
                page.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.data?.analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.session.title ?? a.session.template?.title ?? "Session"}
                  </TableCell>
                  <TableCell>
                    <AnalysisStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(a.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/analyses/${a.id}`}>
                      <Button size="sm" variant="outline" type="button">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
