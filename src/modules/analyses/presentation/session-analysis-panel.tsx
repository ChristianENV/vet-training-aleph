"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnalysisStatus, ReadinessLevel } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchSessionAnalysis,
  requestSessionEvaluation,
  type SessionEvaluationRunDto,
} from "./analyses-api";
import { ANALYSIS_STATUS_LABEL, READINESS_LABEL } from "./analysis-labels";
import { useState } from "react";

type EvaluationPayload = {
  overallScore?: number;
  fluencyScore?: number;
  technicalAccuracyScore?: number;
  clientCommunicationScore?: number;
  professionalismScore?: number;
  confidenceScore?: number;
  readinessLevel?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
};

function readEvaluation(payloadJson: unknown): EvaluationPayload | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const o = payloadJson as Record<string, unknown>;
  const ev = o.evaluation;
  if (!ev || typeof ev !== "object") return null;
  return ev as EvaluationPayload;
}

type Props = {
  sessionId: string;
  sessionStatus: string;
  canRequest: boolean;
  canView: boolean;
  isOwner: boolean;
};

export function SessionAnalysisPanel({
  sessionId,
  sessionStatus,
  canRequest,
  canView,
  isOwner,
}: Props) {
  const queryClient = useQueryClient();
  const enabled = sessionStatus === "COMPLETED" && canView;
  /** Banner after a trigger: succeeded vs failed model run (HTTP 200 can be either). */
  const [evalRunBanner, setEvalRunBanner] = useState<SessionEvaluationRunDto | null>(null);

  const analysisQuery = useQuery({
    queryKey: ["session-analysis", sessionId],
    queryFn: () => fetchSessionAnalysis(sessionId),
    enabled,
  });

  const evaluateMut = useMutation({
    mutationFn: () => requestSessionEvaluation(sessionId),
    onSuccess: (data) => {
      setEvalRunBanner(data.evaluationRun);
      window.setTimeout(() => setEvalRunBanner(null), 8000);
      void queryClient.invalidateQueries({ queryKey: ["session-analysis", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["analyses-list"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
    },
  });

  if (!enabled) {
    return null;
  }

  const analysis = analysisQuery.data?.analysis ?? null;
  const evaluation = analysis?.payloadJson ? readEvaluation(analysis.payloadJson) : null;
  const analysisInFlight =
    analysis?.status === AnalysisStatus.RUNNING || analysis?.status === AnalysisStatus.PENDING;
  const evalDisabled =
    evaluateMut.isPending || analysisInFlight || (analysis?.status === AnalysisStatus.COMPLETED);

  const primaryEvalLabel =
    analysis?.status === AnalysisStatus.FAILED ? "Retry AI evaluation" : "Run AI evaluation";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Session analysis (AI)</CardTitle>
        <CardDescription>
          Structured evaluation from your saved answers (transcript-first). Runs only after the session status
          is Completed. Requires an OpenAI API key on the server (see README).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysisQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading analysis…</p>
        ) : analysisQuery.isError ? (
          <p className="text-destructive text-sm">
            {analysisQuery.error instanceof Error
              ? analysisQuery.error.message
              : "Could not load analysis"}
          </p>
        ) : null}

        {canRequest ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                size="sm"
                disabled={evalDisabled}
                onClick={() => evaluateMut.mutate()}
              >
                {evaluateMut.isPending || analysisInFlight
                  ? "Running evaluation…"
                  : analysis?.status === AnalysisStatus.COMPLETED
                    ? "Evaluation complete"
                    : primaryEvalLabel}
              </Button>
              {evalRunBanner?.outcome === "SUCCEEDED" ? (
                <span className="text-muted-foreground text-sm" role="status">
                  Model run succeeded — results are below.
                </span>
              ) : null}
              {evalRunBanner?.outcome === "FAILED" ? (
                <span className="text-destructive text-sm" role="alert">
                  The model run did not succeed — details are shown below. You can retry.
                </span>
              ) : null}
              {evaluateMut.isError ? (
                <span className="text-destructive text-sm">
                  {evaluateMut.error instanceof Error ? evaluateMut.error.message : "Request failed"}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              <strong>Status:</strong> Pending / Running = in progress · Completed = success · Failed =
              error below (retry) · HTTP 200 is normal; check the status badge and outcome message.
            </p>
            {analysis?.status === AnalysisStatus.COMPLETED ? (
              <p className="text-muted-foreground text-sm">
                This evaluation finished — scores and feedback are below. Use{" "}
                <strong>Analyses</strong> in the nav for the full list.
              </p>
            ) : null}
          </div>
        ) : isOwner ? (
          <p className="text-muted-foreground text-sm">
            Your account is not allowed to start AI evaluations. Ask an administrator if you need access.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Only the learner who owns this session can start an evaluation.
          </p>
        )}

        {!analysis ? (
          <p className="text-muted-foreground text-sm">
            {canRequest
              ? "Run the evaluation to generate scores and feedback."
              : "No evaluation recorded for this session yet."}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs uppercase">Status</span>
              <Badge variant="secondary">{ANALYSIS_STATUS_LABEL[analysis.status]}</Badge>
              {analysis.status === AnalysisStatus.RUNNING ? (
                <span className="text-muted-foreground text-sm">Model is scoring this session…</span>
              ) : null}
              {analysis.status === AnalysisStatus.PENDING ? (
                <span className="text-muted-foreground text-sm">Queued…</span>
              ) : null}
            </div>

            {analysis.status === AnalysisStatus.FAILED && analysis.errorMessage ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Evaluation didn’t finish</p>
                <p className="text-destructive/90 mt-1">{analysis.errorMessage}</p>
                <p className="text-muted-foreground mt-2 text-xs">Try running the evaluation again.</p>
              </div>
            ) : null}

            {analysis.status === AnalysisStatus.COMPLETED && analysis.summary ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Summary</p>
                <p className="text-sm whitespace-pre-wrap">{analysis.summary}</p>
              </div>
            ) : null}

            {analysis.status === AnalysisStatus.COMPLETED && evaluation ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Overall", evaluation.overallScore],
                    ["Fluency", evaluation.fluencyScore],
                    ["Technical accuracy", evaluation.technicalAccuracyScore],
                    ["Client communication", evaluation.clientCommunicationScore],
                    ["Professionalism", evaluation.professionalismScore],
                    ["Confidence", evaluation.confidenceScore],
                  ].map(([label, v]) =>
                    typeof v === "number" ? (
                      <div
                        key={String(label)}
                        className="bg-muted/40 flex justify-between rounded-md border px-2 py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium tabular-nums">{v}</span>
                      </div>
                    ) : null,
                  )}
                </div>
                {evaluation.readinessLevel ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Readiness: </span>
                    <span className="font-medium">
                      {READINESS_LABEL[evaluation.readinessLevel as ReadinessLevel] ??
                        evaluation.readinessLevel}
                    </span>
                  </p>
                ) : null}
                {evaluation.strengths?.length ? (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Strengths
                    </p>
                    <ul className="list-inside list-disc text-sm">
                      {evaluation.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {evaluation.weaknesses?.length ? (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Weaknesses
                    </p>
                    <ul className="list-inside list-disc text-sm">
                      {evaluation.weaknesses.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {evaluation.recommendations?.length ? (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Recommendations
                    </p>
                    <ul className="list-inside list-disc text-sm">
                      {evaluation.recommendations.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
