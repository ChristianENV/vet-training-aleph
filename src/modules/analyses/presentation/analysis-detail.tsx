"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
import { QueryLoadingHint } from "@/components/shared/query-status";
import { fetchAnalysisDetail } from "./analyses-api";
import { ANALYSIS_STATUS_LABEL, READINESS_LABEL } from "./analysis-labels";

type EvalPayload = {
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

function readEvaluation(payloadJson: unknown): EvalPayload | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const o = payloadJson as Record<string, unknown>;
  const ev = o.evaluation;
  if (!ev || typeof ev !== "object") return null;
  return ev as EvalPayload;
}

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
  const ev = a.status === AnalysisStatus.COMPLETED ? readEvaluation(a.payloadJson) : null;
  const transcriptFallbackOrdinals = readTranscriptFallbackOrdinals(session.finalizationMetaJson);

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

      {a.summary ? (
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

      {ev && a.status === AnalysisStatus.COMPLETED ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scores & feedback</CardTitle>
            <CardDescription>Structured evaluation from the language model.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Overall", ev.overallScore],
                ["Fluency", ev.fluencyScore],
                ["Technical accuracy", ev.technicalAccuracyScore],
                ["Client communication", ev.clientCommunicationScore],
                ["Professionalism", ev.professionalismScore],
                ["Confidence", ev.confidenceScore],
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
            {ev.readinessLevel ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Readiness: </span>
                <span className="font-medium">
                  {READINESS_LABEL[ev.readinessLevel as ReadinessLevel] ?? ev.readinessLevel}
                </span>
              </p>
            ) : null}
            {ev.strengths?.length ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                  Strengths
                </p>
                <ul className="list-inside list-disc text-sm">
                  {ev.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {ev.weaknesses?.length ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                  Weaknesses
                </p>
                <ul className="list-inside list-disc text-sm">
                  {ev.weaknesses.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {ev.recommendations?.length ? (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                  Recommendations
                </p>
                <ul className="list-inside list-disc text-sm">
                  {ev.recommendations.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
