"use client";

import { ReadinessLevel } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deriveOverallScore } from "@/modules/openai/domain/evaluation-helpers";
import type { SessionEvaluationOutput } from "@/modules/openai/schemas/session-evaluation-output";
import {
  CONFIDENCE_LEVEL_LABEL,
  EVIDENCE_BASIS_LABEL,
  ORAL_READINESS_LABEL,
  READINESS_LABEL,
} from "./analysis-labels";
import type { LegacySessionEvalV1 } from "./evaluation-payload";

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-muted/40 flex justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {value == null ? <span className="text-muted-foreground font-normal">Not scored</span> : value}
      </span>
    </div>
  );
}

export function EnrichedAnalysisSections({ data }: { data: SessionEvaluationOutput }) {
  const overall = deriveOverallScore(data);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Your coaching snapshot</CardTitle>
            <Badge variant="secondary">
              {ORAL_READINESS_LABEL[data.readinessLevel] ?? data.readinessLevel}
            </Badge>
            <Badge variant="outline">{CONFIDENCE_LEVEL_LABEL[data.confidenceAndLimits.confidenceLevel]}</Badge>
          </div>
          <CardDescription>
            Overall score {overall}/100 — averaged from the three focus areas when scores are available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{data.sessionSummary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scores by focus area</CardTitle>
          <CardDescription>Null means we could not score that area reliably from this session&apos;s evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <ScoreRow label="Overall (derived)" value={overall} />
            <ScoreRow label="Speaking" value={data.scoring.speaking.score} />
            <ScoreRow label="Grammar & language control" value={data.scoring.languageControl.score} />
            <ScoreRow label="Veterinary communication" value={data.scoring.veterinaryCommunication.score} />
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              <span className="font-medium text-foreground">Speaking: </span>
              {data.scoring.speaking.headline}
            </p>
            {data.scoring.speaking.detail ? <p className="whitespace-pre-wrap">{data.scoring.speaking.detail}</p> : null}
            <p>
              <span className="font-medium text-foreground">Language: </span>
              {data.scoring.languageControl.headline}
            </p>
            {data.scoring.languageControl.detail ? (
              <p className="whitespace-pre-wrap">{data.scoring.languageControl.detail}</p>
            ) : null}
            <p>
              <span className="font-medium text-foreground">Client communication: </span>
              {data.scoring.veterinaryCommunication.headline}
            </p>
            {data.scoring.veterinaryCommunication.detail ? (
              <p className="whitespace-pre-wrap">{data.scoring.veterinaryCommunication.detail}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Speaking & delivery</CardTitle>
          <CardDescription>
            {EVIDENCE_BASIS_LABEL[data.audioAndDelivery.evidenceBasis] ?? data.audioAndDelivery.evidenceBasis}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {data.audioAndDelivery.transcriptVsAudioNote}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ScoreRow label="Pronunciation (if available)" value={data.audioAndDelivery.pronunciationScore} />
            <div className="bg-muted/40 flex justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
              <span className="text-muted-foreground">Speaking pace</span>
              <span className="font-medium tabular-nums">
                {data.audioAndDelivery.estimatedPaceWpm == null ? (
                  <span className="text-muted-foreground font-normal">Not estimated</span>
                ) : (
                  `${Math.round(data.audioAndDelivery.estimatedPaceWpm)} WPM`
                )}
              </span>
            </div>
          </div>
          {data.audioAndDelivery.deliveryStrengths.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                What went well
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.audioAndDelivery.deliveryStrengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.audioAndDelivery.deliveryGrowthAreas.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Room to grow
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.audioAndDelivery.deliveryGrowthAreas.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Grammar & language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{data.grammarAndLanguage.overview}</p>
          {data.grammarAndLanguage.strengths.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Strengths
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.grammarAndLanguage.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.grammarAndLanguage.recurringMistakes.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Recurring patterns
              </p>
              <ul className="space-y-3">
                {data.grammarAndLanguage.recurringMistakes.map((m, mi) => (
                  <li key={`${m.pattern}-${mi}`} className="border-muted rounded-md border p-2">
                    <p className="font-medium">{m.pattern}</p>
                    {m.exampleQuotes.length > 0 ? (
                      <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
                        {m.exampleQuotes.map((q, qi) => (
                          <li key={`${m.pattern}-${mi}-${qi}`}>&ldquo;{q}&rdquo;</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-1 text-xs">
                      <span className="text-muted-foreground">Try instead: </span>
                      {m.correction}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.grammarAndLanguage.priorityFixes.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Priority fixes
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.grammarAndLanguage.priorityFixes.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Veterinary communication (US context)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{data.veterinaryCommunication.overview}</p>
          <div className="space-y-2">
            <p>
              <span className="text-muted-foreground text-xs font-medium uppercase">Safety & tone — </span>
              {data.veterinaryCommunication.clientSafetyAndTone}
            </p>
            <p>
              <span className="text-muted-foreground text-xs font-medium uppercase">Plain language — </span>
              {data.veterinaryCommunication.technicalVsPlainLanguage}
            </p>
          </div>
          {data.veterinaryCommunication.usPracticeNorms.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                US practice notes
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.veterinaryCommunication.usPracticeNorms.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-prompt coaching</CardTitle>
          <CardDescription>Short notes for each question in your session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.perQuestionFeedback
            .slice()
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((q) => (
              <details
                key={q.ordinal}
                className="border-muted group rounded-lg border px-3 py-2 text-sm open:bg-muted/20"
              >
                <summary className="cursor-pointer font-medium">
                  Prompt {q.ordinal}
                  {q.promptSnippet ? <span className="text-muted-foreground font-normal"> — {q.promptSnippet}</span> : null}
                </summary>
                <div className="mt-2 space-y-2 pl-1 leading-relaxed">
                  <p>
                    <span className="text-muted-foreground text-xs font-medium uppercase">Worked — </span>
                    {q.whatWorked}
                  </p>
                  <p>
                    <span className="text-muted-foreground text-xs font-medium uppercase">Coach notes — </span>
                    {q.coachNotes}
                  </p>
                  {q.improvedExample ? (
                    <p className="bg-muted/50 rounded-md p-2 text-xs whitespace-pre-wrap">
                      <span className="text-muted-foreground font-medium">Example phrasing — </span>
                      {q.improvedExample}
                    </p>
                  ) : null}
                </div>
              </details>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Action plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="font-medium">{data.actionPlan.onePriorityChange}</p>
          {data.actionPlan.nextSessionFocus.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Next session focus
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.actionPlan.nextSessionFocus.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.actionPlan.practiceDrills.length > 0 ? (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                Practice ideas
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {data.actionPlan.practiceDrills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-muted-foreground/25">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Confidence & limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{data.confidenceAndLimits.summary}</p>
          {data.confidenceAndLimits.limitations.length > 0 ? (
            <ul className="text-muted-foreground list-inside list-disc text-xs">
              {data.confidenceAndLimits.limitations.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function LegacyAnalysisSections({ ev }: { ev: LegacySessionEvalV1 }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scores & feedback</CardTitle>
        <CardDescription>Earlier evaluation format (still valid).</CardDescription>
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
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Strengths</p>
            <ul className="list-inside list-disc text-sm">
              {ev.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {ev.weaknesses?.length ? (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Weaknesses</p>
            <ul className="list-inside list-disc text-sm">
              {ev.weaknesses.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {ev.recommendations?.length ? (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Recommendations</p>
            <ul className="list-inside list-disc text-sm">
              {ev.recommendations.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
