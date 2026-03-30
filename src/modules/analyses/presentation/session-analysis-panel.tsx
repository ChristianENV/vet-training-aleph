"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnalysisStatus } from "@/generated/prisma/enums";
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
import { LoadingState } from "@/components/shared/loading-state";
import { AnalysisStatusBadge } from "@/components/shared/status-badges";
import { formatStoredTechnicalError } from "@/lib/ui/user-facing-errors";
import { EnrichedAnalysisSections, LegacyAnalysisSections } from "./analysis-results-sections";
import {
  getAnalysisPayloadShape,
  readEnrichedEvaluation,
  readLegacyEvaluationV1,
} from "./evaluation-payload";
import { useState } from "react";

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
  const shape =
    analysis?.status === AnalysisStatus.COMPLETED ? getAnalysisPayloadShape(analysis.payloadJson) : "unknown";
  const enriched = shape === "enriched_v2" ? readEnrichedEvaluation(analysis?.payloadJson) : null;
  const legacy = shape === "legacy_v1" ? readLegacyEvaluationV1(analysis?.payloadJson) : null;
  const analysisInFlight =
    analysis?.status === AnalysisStatus.RUNNING || analysis?.status === AnalysisStatus.PENDING;
  const evalDisabled =
    evaluateMut.isPending || analysisInFlight || (analysis?.status === AnalysisStatus.COMPLETED);

  const primaryEvalLabel =
    analysis?.status === AnalysisStatus.FAILED ? "Retry evaluation" : "Run evaluation again";

  const showCompactSummary = analysis?.summary && !enriched;

  return (
    <Card className="border-border/90">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
          Session analysis (AI)
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          After you finish an oral assessment, we score your answers automatically. Transcript and support
          fields are used when needed. If something goes wrong, you can retry evaluation here. Requires an
          OpenAI API key on the server (see README).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {analysisQuery.isLoading ? (
          <LoadingState
            embedded
            title="Loading session analysis"
            hint="This usually takes just a few seconds."
            size="sm"
          />
        ) : analysisQuery.isError ? (
          <p className="text-destructive border-destructive/25 bg-error-100/60 rounded-lg border px-3 py-2.5 text-sm leading-relaxed">
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
                  {evaluateMut.error instanceof Error
                    ? formatStoredTechnicalError(evaluateMut.error.message)
                    : "Request failed"}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              <strong>Status:</strong> Pending / Running = in progress · Completed = success · Failed =
              error below (retry) · HTTP 200 is normal; check the status badge and outcome message.
            </p>
            {analysis?.status === AnalysisStatus.COMPLETED ? (
              <p className="text-muted-foreground text-sm">
                This evaluation finished — coaching details are below. Use <strong>Analyses</strong> in the nav
                for the full page view.
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
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                Status
              </span>
              <AnalysisStatusBadge status={analysis.status} />
              {analysis.status === AnalysisStatus.RUNNING ? (
                <span className="text-muted-foreground text-sm">Model is scoring this session…</span>
              ) : null}
              {analysis.status === AnalysisStatus.PENDING ? (
                <span className="text-muted-foreground text-sm">Queued…</span>
              ) : null}
            </div>

            {analysis.status === AnalysisStatus.FAILED && analysis.errorMessage ? (
              <div className="border-destructive/25 bg-error-100/70 rounded-lg border p-4 text-sm shadow-sm">
                <p className="font-semibold text-destructive">Evaluation didn’t finish</p>
                <p className="text-destructive mt-1.5 leading-relaxed">{analysis.errorMessage}</p>
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  Try running the evaluation again.
                </p>
              </div>
            ) : null}

            {analysis.status === AnalysisStatus.COMPLETED && showCompactSummary ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Summary</p>
                <p className="text-sm whitespace-pre-wrap">{analysis.summary}</p>
              </div>
            ) : null}

            {analysis.status === AnalysisStatus.COMPLETED && enriched ? (
              <div className="max-h-[min(70vh,720px)] overflow-y-auto pr-1">
                <EnrichedAnalysisSections data={enriched} perPromptEvidence={analysis.perPromptEvidence} />
              </div>
            ) : null}

            {analysis.status === AnalysisStatus.COMPLETED && !enriched && legacy ? (
              <LegacyAnalysisSections ev={legacy} />
            ) : null}

            {analysis.status === AnalysisStatus.COMPLETED && !enriched && !legacy ? (
              <p className="text-muted-foreground text-sm">
                Results are saved in an unrecognized format. Try running the evaluation again.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
