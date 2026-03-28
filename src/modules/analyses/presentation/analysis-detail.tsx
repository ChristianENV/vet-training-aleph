"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AnalysisStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QueryLoadingHint } from "@/components/shared/query-status";
import { fetchAnalysisDetail } from "./analyses-api";
import { ANALYSIS_STATUS_LABEL } from "./analysis-labels";
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
    return <QueryLoadingHint>Loading analysis…</QueryLoadingHint>;
  }

  if (q.isError || !q.data?.analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Not available</CardTitle>
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

  const a = q.data.analysis;
  const session = a.session as SessionInfo;
  const shape = a.status === AnalysisStatus.COMPLETED ? getAnalysisPayloadShape(a.payloadJson) : "unknown";
  const enriched = shape === "enriched_v2" ? readEnrichedEvaluation(a.payloadJson) : null;
  const legacy = shape === "legacy_v1" ? readLegacyEvaluationV1(a.payloadJson) : null;
  const transcriptFallbackOrdinals = readTranscriptFallbackOrdinals(session.finalizationMetaJson);
  const showStandaloneSummary = a.summary && !enriched;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Session analysis</h2>
          <p className="text-muted-foreground text-sm">
            {session.title ?? session.template?.title ?? "Session"} · {session.user.email}
          </p>
        </div>
        <Badge variant="secondary">{ANALYSIS_STATUS_LABEL[a.status]}</Badge>
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
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Written notes used for some prompts</CardTitle>
            <CardDescription>
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
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{a.summary}</p>
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
            <p className="text-destructive text-sm">{a.errorMessage}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Open the session and use &quot;Run evaluation again&quot; if available, or contact support if this
              persists.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {a.status === AnalysisStatus.COMPLETED && enriched ? <EnrichedAnalysisSections data={enriched} /> : null}

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
