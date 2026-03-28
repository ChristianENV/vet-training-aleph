"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OralRecorderResult } from "@/hooks/use-oral-recorder";
import { SessionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SessionProgressDto, SessionQuestionRow, SessionResponseRow, TrainingSessionRow } from "./sessions-api";
import { OralRecorderPanel } from "./oral-recorder-panel";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL } from "./session-labels";
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
          "bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 -mx-4 border-b px-4 pb-3 backdrop-blur-md sm:-mx-0 sm:px-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 py-2">
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">
              {s.title ?? topicLabel}
            </h2>
            <Badge variant="secondary" className="shrink-0">
              {SESSION_STATUS_LABEL[s.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-muted text-muted-foreground inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
              {typeLabel}
            </span>
            <span className="text-muted-foreground max-w-[min(100%,28rem)] truncate text-xs">
              {topicLabel}
            </span>
          </div>
        </div>

        {totalQuestions > 0 ? (
          <div className="mt-4 space-y-2">
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${Math.min(100, progress.completionPercent)}%` }}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">
                  Question {displayIndex > 0 ? displayIndex : "—"} of {totalQuestions}
                </span>
                <span className="tabular-nums">{progress.completionPercent}% complete</span>
              </div>
              {guidanceLabel ? (
                <p className="text-muted-foreground text-xs">
                  Suggested focus: {guidanceLabel} — not a hard deadline.
                </p>
              ) : null}
              {currentQuestion && canMutate ? (
                <p className="text-muted-foreground text-xs">
                  {attemptsExhausted ? (
                    <span className="text-foreground">All {maxAttempts} attempts used for this prompt.</span>
                  ) : (
                    <>
                      Attempt {nextAttemptNum} of {maxAttempts}
                      {isLastAttempt ? (
                        <span className="text-foreground"> — last attempt for this prompt.</span>
                      ) : null}
                    </>
                  )}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {totalQuestions > 0 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  locked && "cursor-not-allowed opacity-40",
                  active && "border-primary bg-primary text-primary-foreground",
                  !active && !locked && "bg-muted/50 hover:bg-muted",
                  isCurrent && !active && "ring-primary ring-offset-background ring-2 ring-offset-1",
                )}
                aria-current={active ? "step" : undefined}
                aria-label={`Question ${q.ordinal}${locked ? " (locked)" : ""}${answered ? " answered" : ""}`}
              >
                {q.ordinal}
              </button>
            );
          })}
        </div>
      ) : null}

      {currentQuestion ? (
        <>
          <Separator className="my-8" />
          <section className="space-y-6" aria-labelledby="oral-prompt-heading">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {wizardMode === "focus" ? (
                  <Badge variant="default" className="font-normal">
                    Current prompt
                  </Badge>
                ) : wizardMode === "review" ? (
                  <Badge variant="outline" className="font-normal">
                    Earlier prompt
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    Review
                  </Badge>
                )}
              </div>
              <h3 id="oral-prompt-heading" className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                {currentQuestion.promptText}
              </h3>
              {currentQuestion.helpText ? (
                <p className="text-muted-foreground text-sm leading-relaxed">{currentQuestion.helpText}</p>
              ) : null}
            </div>

            <Card className="border-dashed">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Your spoken answer</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Record in one take. Your answer is kept on this device until you save it — uploads run later
                    when the product is connected to storage.
                  </p>
                </div>

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
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                    <p className="font-medium">Saved for this prompt</p>
                    <p className="text-muted-foreground text-xs">
                      {savedForCurrent.answeredAt
                        ? new Date(savedForCurrent.answeredAt).toLocaleString()
                        : "—"}
                      {savedForCurrent.finalAudioDurationSec != null ? (
                        <> · about {savedForCurrent.finalAudioDurationSec}s</>
                      ) : null}
                    </p>
                  </div>
                ) : null}

                <details className="group rounded-lg border bg-muted/10">
                  <summary className="text-muted-foreground [&::-webkit-details-marker]:hidden cursor-pointer list-none px-3 py-2.5 text-sm font-medium">
                    Support transcript
                    <span className="text-muted-foreground/80 ml-1 text-xs font-normal">
                      — read only in v1
                    </span>
                  </summary>
                  <div className="border-t px-3 py-3">
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {savedForCurrent?.transcriptText?.trim()
                        ? savedForCurrent.transcriptText
                        : "No transcript for this prompt. Transcripts are not edited here."}
                    </p>
                  </div>
                </details>

                {hasUnsavedLocalTake && canMutate && !attemptsExhausted ? (
                  <p className="text-muted-foreground text-xs" role="status">
                    You have a recording that is not saved yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <p className="text-muted-foreground mt-6 text-sm">No question selected.</p>
      )}

      {canMutate && currentQuestion ? (
        <div
          className={cn(
            "border-border bg-background/95 supports-[backdrop-filter]:bg-background/90 sticky bottom-0 z-20 mt-8 flex flex-col gap-3 border-t py-4 backdrop-blur-md",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
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
            <p className="text-destructive text-center text-xs">{saveBlockedReason}</p>
          ) : null}
          {attemptsExhausted ? (
            <p className="text-muted-foreground text-center text-xs">
              You can still replay your last saved take or move between prompts above.
            </p>
          ) : null}
        </div>
      ) : null}

      {canMutate && showComplete ? (
        <p className="text-muted-foreground mt-4 text-center text-sm">
          All prompts have a saved answer. Use <strong>Finish assessment</strong> in the header when you are
          ready.
        </p>
      ) : null}
    </div>
  );
}
