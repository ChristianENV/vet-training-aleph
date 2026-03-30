"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AnalysisStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { formatStoredTechnicalError } from "@/lib/ui/user-facing-errors";
import { fetchAnalysisDetail, type SessionAnalysisDto } from "./analyses-api";
import { AnalysisStatusBadge } from "@/components/shared/status-badges";
import { EnrichedAnalysisSections, LegacyAnalysisSections } from "./analysis-results-sections";
import {
  getAnalysisPayloadShape,
  readEnrichedEvaluation,
  readLegacyEvaluationV1,
} from "./evaluation-payload";

type SessionInfo = {
  id: string;
  title: string | null;
  userId: string;
  finalizationMetaJson?: unknown;
  template: { title: string; slug: string; sessionType: string } | null;
  user: { id: string; email: string; name: string | null };
};

function readTranscriptFallbackOrdinals(meta: unknown): number[] {
  if (!meta || typeof meta !== "object") return [];
  const o = meta as Record<string, unknown>;
  const arr = o.transcriptFallbackOrdinals;
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is number => typeof x === "number");
}

type Props = { analysisId: string };

export function AnalysisDetail({ analysisId }: Props) {
  const q = useQuery({
    queryKey: ["analysis-detail", analysisId],
    queryFn: () => fetchAnalysisDetail(analysisId),
  });

  if (q.isLoading) {
    return (
      <LoadingState
        layout="fullscreen"
        title="Loading your results"
        description="We're fetching this evaluation and session details."
        hint="Your feedback includes grammar, clarity, and professional communication."
      />
    );
  }

  if (q.isError || !q.data?.analysis) {
    return (
      <Card className="max-w-lg border-dashed">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">Not available</CardTitle>
          <CardDescription>
            {q.error instanceof Error ? q.error.message : "Could not load this analysis."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/analyses">
            <Button variant="outline" type="button">
              Back to analyses
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const a = q.data.analysis as SessionAnalysisDto & { session: SessionInfo };
  const session = a.session;
  const shape = a.status === AnalysisStatus.COMPLETED ? getAnalysisPayloadShape(a.payloadJson) : "unknown";
  const enriched = shape === "enriched_v2" ? readEnrichedEvaluation(a.payloadJson) : null;
  const legacy = shape === "legacy_v1" ? readLegacyEvaluationV1(a.payloadJson) : null;
  const transcriptFallbackOrdinals = readTranscriptFallbackOrdinals(session.finalizationMetaJson);
  const showStandaloneSummary = a.summary && !enriched;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
            Analysis
          </p>
          <h2 className="text-brand-navy-900 text-xl font-semibold tracking-tight sm:text-2xl">
            Session analysis
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {session.title ?? session.template?.title ?? "Session"} · {session.user.email}
          </p>
        </div>
        <AnalysisStatusBadge status={a.status} className="shrink-0" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/sessions/${session.id}`}>
          <Button size="sm" variant="outline" type="button">
            Open session
          </Button>
        </Link>
        <Link href="/analyses">
          <Button size="sm" variant="ghost" type="button">
            ← All analyses
          </Button>
        </Link>
      </div>

      {transcriptFallbackOrdinals.length > 0 ? (
        <Card className="border-warning-500/35 bg-warning-100 shadow-sm">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-base font-semibold tracking-tight">
              Written notes used for some prompts
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              For prompt{transcriptFallbackOrdinals.length === 1 ? " " : "s "}
              {transcriptFallbackOrdinals.join(", ")}, scoring used your written support notes. That can happen
              when a voice answer cannot be saved for processing; voice is still preferred whenever it is
              available.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {showStandaloneSummary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{a.summary}</p>
          </CardContent>
        </Card>
      ) : null}

      {a.status === AnalysisStatus.FAILED && a.errorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">Evaluation failed</CardTitle>
            <CardDescription>The model could not produce a result for this run.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-destructive text-sm">{formatStoredTechnicalError(a.errorMessage)}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Open the session and use &quot;Run evaluation again&quot; if available, or contact support if this
              persists.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {a.status === AnalysisStatus.COMPLETED && enriched ? (
        <EnrichedAnalysisSections data={enriched} perPromptEvidence={a.perPromptEvidence} />
      ) : null}

      {a.status === AnalysisStatus.COMPLETED && !enriched && legacy ? <LegacyAnalysisSections ev={legacy} /> : null}

      {a.status === AnalysisStatus.COMPLETED && !enriched && !legacy ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results format</CardTitle>
            <CardDescription>
              This analysis completed, but the result could not be read in a supported format. Try &quot;Run
              evaluation again&quot; from the session page.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
