"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { OralRecorderResult } from "@/hooks/use-oral-recorder";
import { SessionStatus } from "@/generated/prisma/enums";
import { SessionStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SessionProgressDto, SessionQuestionRow, SessionResponseRow, TrainingSessionRow } from "./sessions-api";
import { OralRecorderPanel } from "./oral-recorder-panel";
import { SESSION_TYPE_LABEL } from "./session-labels";
import {
  findNextNavigableQuestionId,
  findPrevNavigableQuestionId,
  formatSuggestedFocusLabel,
  pickGuidanceSeconds,
  responseHasContent,
  type LocalVoiceTake,
} from "./session-wizard-helpers";

export type OralAssessmentWizardProps = {
  session: TrainingSessionRow;
  progress: SessionProgressDto;
  questionsOrdered: SessionQuestionRow[];
  responseByQuestion: Map<string, SessionResponseRow>;
  effectiveQuestionId: string | null;
  currentQuestion: SessionQuestionRow | null;
  firstUnsatisfiedIdx: number;
  isQuestionLocked: (q: SessionQuestionRow) => boolean;
  onSelectQuestion: (id: string) => void;
  localTake: LocalVoiceTake | null;
  onVoiceTakeReady: (result: OralRecorderResult) => void;
  onDiscardVoiceTake: () => void;
  canMutate: boolean;
  onSaveAnswer: () => void;
  responseMutPending: boolean;
  canSubmitAnswer: boolean;
  saveBlockedReason?: string | null;
  hasUnsavedLocalTake: boolean;
  showComplete: boolean;
  onComplete: () => void;
  completeMutPending: boolean;
  onCancel: () => void;
  cancelMutPending: boolean;
};

export function OralAssessmentWizard({
  session: s,
  progress,
  questionsOrdered,
  responseByQuestion,
  effectiveQuestionId,
  currentQuestion,
  firstUnsatisfiedIdx,
  isQuestionLocked,
  onSelectQuestion,
  localTake,
  onVoiceTakeReady,
  onDiscardVoiceTake,
  canMutate,
  onSaveAnswer,
  responseMutPending,
  canSubmitAnswer,
  saveBlockedReason,
  hasUnsavedLocalTake,
  showComplete,
  onComplete,
  completeMutPending,
  onCancel,
  cancelMutPending,
}: OralAssessmentWizardProps) {
  const topicLabel = s.template?.title ?? s.title ?? "Practice topic";
  const typeLabel = s.template ? SESSION_TYPE_LABEL[s.template.sessionType] : "Session";

  const currentIdx = effectiveQuestionId
    ? questionsOrdered.findIndex((q) => q.id === effectiveQuestionId)
    : -1;
  const displayIndex = currentIdx >= 0 ? currentIdx + 1 : 0;
  const totalQuestions = questionsOrdered.length;

  const savedForCurrent = effectiveQuestionId
    ? responseByQuestion.get(effectiveQuestionId)
    : undefined;
  const hasSavedContent = responseHasContent(savedForCurrent);
  const maxAttempts = savedForCurrent?.maxAttempts ?? 3;
  const attemptsUsed = savedForCurrent?.attemptCount ?? 0;
  const attemptsExhausted = !!savedForCurrent && attemptsUsed >= maxAttempts;
  const nextAttemptNum = Math.min(attemptsUsed + 1, maxAttempts);
  const isLastAttempt = nextAttemptNum >= maxAttempts && !attemptsExhausted;
  const isCurrentFocus =
    s.status === SessionStatus.ACTIVE &&
    firstUnsatisfiedIdx >= 0 &&
    progress.currentQuestionId === currentQuestion?.id;

  const wizardMode: "focus" | "review" | "review_done" =
    firstUnsatisfiedIdx < 0 ? "review_done" : isCurrentFocus ? "focus" : "review";

  const prevId = findPrevNavigableQuestionId(questionsOrdered, effectiveQuestionId, isQuestionLocked);
  const nextId = findNextNavigableQuestionId(questionsOrdered, effectiveQuestionId, isQuestionLocked);

  const guidanceSec = currentQuestion ? pickGuidanceSeconds(currentQuestion) : null;
  const guidanceLabel = formatSuggestedFocusLabel(guidanceSec);

  const canRecordAgain = canMutate && !attemptsExhausted;

  const [recorderEpoch, setRecorderEpoch] = useState(0);
  useEffect(() => {
    setRecorderEpoch(0);
  }, [effectiveQuestionId]);

  const handleDiscardVoice = () => {
    onDiscardVoiceTake();
    setRecorderEpoch((e) => e + 1);
  };

  return (
    <div className="flex flex-col gap-0">
      <header
        className={cn(
          "bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-0 z-30 -mx-4 border-b border-border/80 px-4 pb-4 shadow-[0_6px_24px_-12px_rgba(22,36,63,0.12)] backdrop-blur-md sm:-mx-0 sm:px-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 py-2.5">
          <Link
            href="/sessions"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground -ml-2 h-8 px-2",
            )}
          >
            ← Sessions
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {canMutate && showComplete ? (
              <Button
                type="button"
                size="sm"
                disabled={completeMutPending}
                onClick={() => onComplete()}
              >
                {completeMutPending ? "Saving…" : "Finish assessment"}
              </Button>
            ) : null}
            {canMutate ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cancelMutPending}
                onClick={() => onCancel()}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-brand-navy-900 text-lg leading-snug font-semibold tracking-tight sm:text-xl">
              {s.title ?? topicLabel}
            </h2>
            <SessionStatusBadge status={s.status} className="shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-muted/80 text-muted-foreground inline-flex max-w-full items-center rounded-md border border-border/80 px-2.5 py-1 text-xs font-medium">
              {typeLabel}
            </span>
            <span className="text-muted-foreground max-w-[min(100%,28rem)] truncate text-xs leading-relaxed">
              {topicLabel}
            </span>
          </div>
        </div>

        {totalQuestions > 0 ? (
          <div className="mt-5 space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                  Session progress
                </span>
                <span className="text-muted-foreground tabular-nums text-xs font-medium">
                  {progress.completionPercent}%
                </span>
              </div>
              <div className="bg-muted border-border/60 h-2.5 w-full overflow-hidden rounded-full border">
                <div
                  className="bg-progress-fill h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, progress.completionPercent)}%` }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="text-foreground text-sm font-semibold tracking-tight">
                  Question {displayIndex > 0 ? displayIndex : "—"} of {totalQuestions}
                </span>
              </div>
              {guidanceLabel ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Suggested focus: {guidanceLabel} — not a hard deadline.
                </p>
              ) : null}
              {currentQuestion && canMutate ? (
                <div className="space-y-2">
                  {isLastAttempt && !attemptsExhausted ? (
                    <p
                      className="text-foreground border-warning-500/30 bg-warning-100/90 rounded-md border px-2.5 py-2 text-xs leading-relaxed"
                      role="status"
                    >
                      <span className="font-semibold">Last attempt for this prompt.</span> Listen back and save
                      when you are satisfied — you will not be able to record again here.
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {attemptsExhausted ? (
                      <span className="text-foreground font-medium">
                        All {maxAttempts} attempts used for this prompt.
                      </span>
                    ) : (
                      <>
                        Attempt <span className="text-foreground font-medium">{nextAttemptNum}</span> of{" "}
                        {maxAttempts}
                      </>
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {totalQuestions > 0 ? (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {questionsOrdered.map((q) => {
            const answered = responseHasContent(responseByQuestion.get(q.id));
            const locked = isQuestionLocked(q);
            const active = q.id === effectiveQuestionId;
            const isCurrent =
              s.status === SessionStatus.ACTIVE &&
              firstUnsatisfiedIdx >= 0 &&
              progress.currentQuestionId === q.id;
            return (
              <button
                key={q.id}
                type="button"
                disabled={locked || !canMutate}
                onClick={() => onSelectQuestion(q.id)}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all sm:size-9 sm:text-xs",
                  locked &&
                    "border-muted-foreground/25 bg-muted/20 text-muted-foreground cursor-not-allowed border-dashed opacity-45",
                  active && "border-primary bg-primary text-primary-foreground shadow-sm",
                  !active &&
                    !locked &&
                    answered &&
                    "border-success-500/35 bg-success-100/70 text-brand-navy-800 hover:bg-success-100",
                  !active && !locked && !answered && "border-border/90 bg-muted/40 text-foreground hover:border-border hover:bg-muted",
                  isCurrent && !active && "ring-brand-cyan-600 ring-offset-background ring-2 ring-offset-2",
                )}
                aria-current={active ? "step" : undefined}
                aria-label={`Question ${q.ordinal}${locked ? " (locked)" : ""}${answered ? " answered" : ""}`}
              >
                {answered && !active && !locked ? (
                  <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                ) : (
                  q.ordinal
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {currentQuestion ? (
        <>
          <Separator className="my-6 sm:my-8" />
          <section className="space-y-6 sm:space-y-7" aria-labelledby="oral-prompt-heading">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {wizardMode === "focus" ? (
                  <Badge variant="progress" className="font-semibold">
                    Current prompt
                  </Badge>
                ) : wizardMode === "review" ? (
                  <Badge variant="outline" className="font-semibold">
                    Earlier prompt
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-semibold">
                    Review
                  </Badge>
                )}
              </div>
              <h3
                id="oral-prompt-heading"
                className="text-brand-navy-900 text-xl leading-snug font-semibold tracking-tight sm:text-2xl sm:leading-snug"
              >
                {currentQuestion.promptText}
              </h3>
              {currentQuestion.helpText ? (
                <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed sm:text-[0.9375rem]">
                  {currentQuestion.helpText}
                </p>
              ) : null}
            </div>

            <Card className="border-brand-navy-600/12 overflow-hidden shadow-md">
              <div className="bg-muted/35 border-b border-border/70 px-4 py-3.5 sm:px-5">
                <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
                  Your spoken answer
                </p>
                <p className="text-muted-foreground mt-1.5 max-w-2xl text-xs leading-relaxed">
                  Record in one take. Your answer stays on this device until you save — uploads run when storage is
                  connected.
                </p>
              </div>
              <CardContent className="space-y-5 px-4 pt-5 pb-6 sm:px-5">

                {effectiveQuestionId ? (
                  <OralRecorderPanel
                    key={`${effectiveQuestionId}-${recorderEpoch}`}
                    questionId={effectiveQuestionId}
                    localTake={localTake}
                    onTakeReady={onVoiceTakeReady}
                    onDiscardLocal={handleDiscardVoice}
                    disabled={!canMutate}
                    canRecordAgain={canRecordAgain}
                  />
                ) : null}

                {hasSavedContent && savedForCurrent ? (
                  <div className="bg-muted/25 border-border/80 space-y-1.5 rounded-lg border p-3.5 text-sm">
                    <p className="text-foreground font-semibold">Saved for this prompt</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {savedForCurrent.answeredAt
                        ? new Date(savedForCurrent.answeredAt).toLocaleString()
                        : "—"}
                      {savedForCurrent.finalAudioDurationSec != null ? (
                        <> · about {savedForCurrent.finalAudioDurationSec}s</>
                      ) : null}
                    </p>
                  </div>
                ) : null}

                <details className="group border-border/80 bg-muted/15 rounded-lg border">
                  <summary className="text-foreground [&::-webkit-details-marker]:hidden cursor-pointer list-none px-3 py-3 text-sm font-medium transition-colors hover:bg-muted/25">
                    Support transcript
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      — read only in v1
                    </span>
                  </summary>
                  <div className="border-border/60 border-t px-3 py-3">
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {savedForCurrent?.transcriptText?.trim()
                        ? savedForCurrent.transcriptText
                        : "No transcript for this prompt. Transcripts are not edited here."}
                    </p>
                  </div>
                </details>

                {hasUnsavedLocalTake && canMutate && !attemptsExhausted ? (
                  <p
                    className="text-foreground border-brand-cyan-600/25 bg-brand-cyan-500/[0.06] rounded-md border px-3 py-2 text-xs leading-relaxed"
                    role="status"
                  >
                    <span className="font-medium">Unsaved recording.</span> Save your answer below when you are
                    ready to keep this take.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <p className="text-muted-foreground border-border/70 bg-muted/20 mt-6 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          No question selected.
        </p>
      )}

      {canMutate && currentQuestion ? (
        <div
          className={cn(
            "border-border/90 bg-background/95 supports-[backdrop-filter]:bg-background/92 sticky bottom-0 z-20 mt-8 flex flex-col gap-3.5 rounded-t-xl border-t py-4 shadow-[0_-10px_40px_-16px_rgba(22,36,63,0.14)] backdrop-blur-md",
            "pb-[max(1rem,env(safe-area-inset-bottom))] pt-4",
          )}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!prevId || responseMutPending}
              onClick={() => prevId && onSelectQuestion(prevId)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nextId || responseMutPending}
              onClick={() => nextId && onSelectQuestion(nextId)}
            >
              Next
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
            <Button
              type="button"
              className="w-full sm:max-w-md"
              disabled={responseMutPending || !canSubmitAnswer || attemptsExhausted}
              onClick={() => onSaveAnswer()}
            >
              {responseMutPending ? "Saving…" : "Save answer"}
            </Button>
          </div>
          {saveBlockedReason ? (
            <p className="text-destructive border-destructive/20 bg-error-100/70 rounded-lg border px-3 py-2 text-center text-xs leading-relaxed">
              {saveBlockedReason}
            </p>
          ) : null}
          {attemptsExhausted ? (
            <p className="text-muted-foreground text-center text-xs leading-relaxed">
              You can still replay your last saved take or move between prompts above.
            </p>
          ) : null}
        </div>
      ) : null}

      {canMutate && showComplete ? (
        <p className="text-muted-foreground border-border/60 bg-muted/25 mt-4 rounded-lg border px-4 py-3 text-center text-sm leading-relaxed">
          All prompts have a saved answer. Use <strong className="text-foreground">Finish assessment</strong> in
          the header when you are ready.
        </p>
      ) : null}
    </div>
  );
}
