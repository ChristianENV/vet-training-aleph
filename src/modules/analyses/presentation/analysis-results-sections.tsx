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
import type { PerPromptEvidenceDto } from "@/modules/analyses/application/per-prompt-evidence";
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
    <div className="bg-surface border-border/90 flex justify-between gap-3 rounded-lg border px-3 py-2 text-sm shadow-sm">
      <span className="text-muted-foreground leading-snug">{label}</span>
      <span className="text-brand-navy-900 font-semibold tabular-nums">
        {value == null ? <span className="text-muted-foreground font-normal">Not scored</span> : value}
      </span>
    </div>
  );
}

function snippet(text: string | null | undefined, max = 100): string | null {
  const t = text?.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function EnrichedAnalysisSections({
  data,
  perPromptEvidence,
}: {
  data: SessionEvaluationOutput;
  perPromptEvidence?: PerPromptEvidenceDto[] | null;
}) {
  const overall = deriveOverallScore(data);
  const byOrdinal = new Map((perPromptEvidence ?? []).map((e) => [e.ordinal, e]));

  return (
    <div className="space-y-6">
      <Card className="border-brand-cyan-600/20 bg-brand-cyan-500/[0.06] overflow-hidden shadow-md">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                Coaching snapshot
              </p>
              <CardTitle className="text-brand-navy-900 text-lg font-semibold tracking-tight sm:text-xl">
                Your session at a glance
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {ORAL_READINESS_LABEL[data.readinessLevel] ?? data.readinessLevel}
              </Badge>
              <Badge variant="outline">{CONFIDENCE_LEVEL_LABEL[data.confidenceAndLimits.confidenceLevel]}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-3 border-t border-border/60 pt-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Overall score</p>
              <p className="text-brand-navy-900 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                {overall}
                <span className="text-muted-foreground text-xl font-medium sm:text-2xl">/100</span>
              </p>
            </div>
            <p className="text-muted-foreground max-w-xl text-xs leading-relaxed sm:text-sm">
              Averaged from the three focus areas below when scores are available.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-border/50 bg-surface/60 pt-5 text-sm leading-relaxed">
          <p className="text-foreground whitespace-pre-wrap">{data.sessionSummary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
            Scores by focus area
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Null means we could not score that area reliably from this session&apos;s evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="bg-muted/25 border-border/80 space-y-2 rounded-xl border p-3.5">
              <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                Speaking
              </p>
              <ScoreRow label="Score" value={data.scoring.speaking.score} />
              <p className="text-foreground pt-1 text-sm leading-snug font-medium">
                {data.scoring.speaking.headline}
              </p>
              {data.scoring.speaking.detail ? (
                <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {data.scoring.speaking.detail}
                </p>
              ) : null}
            </div>
            <div className="bg-muted/25 border-border/80 space-y-2 rounded-xl border p-3.5">
              <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                Grammar &amp; language
              </p>
              <ScoreRow label="Score" value={data.scoring.languageControl.score} />
              <p className="text-foreground pt-1 text-sm leading-snug font-medium">
                {data.scoring.languageControl.headline}
              </p>
              {data.scoring.languageControl.detail ? (
                <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {data.scoring.languageControl.detail}
                </p>
              ) : null}
            </div>
            <div className="bg-muted/25 border-border/80 space-y-2 rounded-xl border p-3.5 sm:col-span-1">
              <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                Veterinary communication
              </p>
              <ScoreRow label="Score" value={data.scoring.veterinaryCommunication.score} />
              <p className="text-foreground pt-1 text-sm leading-snug font-medium">
                {data.scoring.veterinaryCommunication.headline}
              </p>
              {data.scoring.veterinaryCommunication.detail ? (
                <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                  {data.scoring.veterinaryCommunication.detail}
                </p>
              ) : null}
            </div>
          </div>
          <ScoreRow label="Overall (derived)" value={overall} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
            Speaking &amp; delivery
          </CardTitle>
          <CardDescription>
            {EVIDENCE_BASIS_LABEL[data.audioAndDelivery.evidenceBasis] ?? data.audioAndDelivery.evidenceBasis}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">
            {data.audioAndDelivery.transcriptVsAudioNote}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ScoreRow label="Pronunciation (if available)" value={data.audioAndDelivery.pronunciationScore} />
            <div className="bg-surface border-border/90 flex justify-between gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm">
              <span className="text-muted-foreground">Speaking pace</span>
              <span className="text-brand-navy-900 font-semibold tabular-nums">
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
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
            Grammar &amp; language
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p className="text-foreground whitespace-pre-wrap">{data.grammarAndLanguage.overview}</p>
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
                  <li
                    key={`${m.pattern}-${mi}`}
                    className="border-border/80 bg-muted/20 rounded-lg border p-3 shadow-sm"
                  >
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
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
            Veterinary communication (US context)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p className="text-foreground whitespace-pre-wrap">{data.veterinaryCommunication.overview}</p>
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
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">
            Per-prompt coaching
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Prompt, your answer, and coaching — expand each row to review in full.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.perQuestionFeedback
            .slice()
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((q) => {
              const ev = byOrdinal.get(q.ordinal);
              const headline =
                snippet(ev?.promptText, 120) ?? q.promptSnippet ?? `Question ${q.ordinal}`;
              return (
                <details
                  key={q.ordinal}
                  className="border-border/80 bg-muted/10 group rounded-xl border text-sm open:bg-muted/25 open:shadow-sm"
                >
                  <summary className="text-foreground cursor-pointer px-3 py-3 font-semibold tracking-tight sm:px-4 [&::-webkit-details-marker]:hidden">
                    <span className="text-brand-cyan-700 font-semibold tabular-nums dark:text-brand-cyan-500">
                      Q{q.ordinal}
                    </span>
                    <span className="text-muted-foreground font-normal"> — {headline}</span>
                  </summary>
                  <div className="border-border/60 space-y-4 border-t px-3 py-4 pl-4 leading-relaxed sm:px-5 sm:pl-5">
                    {ev?.promptText ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                          Full prompt
                        </p>
                        <p className="text-foreground/90 whitespace-pre-wrap text-sm">{ev.promptText}</p>
                      </div>
                    ) : null}

                    {ev?.usedWrittenNotesFallback ? (
                      <p className="text-foreground border-warning-500/30 bg-warning-100/90 rounded-lg border px-3 py-2 text-xs leading-relaxed">
                        For this prompt, scoring used your written support notes instead of a processed voice
                        recording.
                      </p>
                    ) : null}

                    {ev?.audioPlaybackUrl ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                          Your answer (audio)
                        </p>
                        <audio
                          className="bg-background border-border/60 h-9 w-full max-w-md rounded-lg border"
                          controls
                          preload="metadata"
                          src={ev.audioPlaybackUrl}
                        />
                      </div>
                    ) : ev?.hasStoredAudio ? (
                      <p className="text-muted-foreground text-xs">
                        Your voice answer is saved, but playback in the browser isn’t available here (for example,
                        if a public listening link isn’t set up yet).
                      </p>
                    ) : null}

                    {ev?.transcriptText ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                          Transcript
                        </p>
                        <p className="text-foreground/95 whitespace-pre-wrap text-sm leading-relaxed">
                          {ev.transcriptText}
                        </p>
                      </div>
                    ) : null}

                    <div className="border-border/70 bg-muted/15 space-y-3 rounded-lg border p-3 sm:p-4">
                      <p className="text-sm">
                        <span className="text-muted-foreground mb-1 block text-[0.6875rem] font-semibold tracking-wide uppercase">
                          What worked
                        </span>
                        {q.whatWorked}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground mb-1 block text-[0.6875rem] font-semibold tracking-wide uppercase">
                          Coach notes
                        </span>
                        {q.coachNotes}
                      </p>
                      {q.improvedExample ? (
                        <p className="border-brand-cyan-600/15 bg-brand-cyan-500/[0.05] rounded-lg border px-3 py-2.5 text-xs whitespace-pre-wrap leading-relaxed">
                          <span className="text-muted-foreground mb-1 block font-semibold">Example phrasing</span>
                          {q.improvedExample}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </details>
              );
            })}
        </CardContent>
      </Card>

      <Card className="border-brand-navy-600/12 bg-muted/10 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <p className="text-brand-cyan-700 text-[0.6875rem] font-semibold tracking-wide uppercase dark:text-brand-cyan-500">
            Next steps
          </p>
          <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">Action plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-foreground text-base font-semibold leading-snug">{data.actionPlan.onePriorityChange}</p>
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

      <Card className="border-border/80 bg-muted/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-semibold tracking-tight">
            Confidence &amp; limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{data.confidenceAndLimits.summary}</p>
          {data.confidenceAndLimits.limitations.length > 0 ? (
            <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed">
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
      <CardHeader className="space-y-1">
        <CardTitle className="text-brand-navy-900 text-base font-semibold tracking-tight">Scores &amp; feedback</CardTitle>
        <CardDescription className="text-sm">Earlier evaluation format (still valid).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
                className="bg-surface border-border/90 flex justify-between rounded-lg border px-3 py-2 text-sm shadow-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="text-brand-navy-900 font-semibold tabular-nums">{v}</span>
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
