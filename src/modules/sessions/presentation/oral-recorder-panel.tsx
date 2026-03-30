"use client";

import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOralRecorder, type OralRecorderResult } from "@/hooks/use-oral-recorder";
import type { LocalVoiceTake } from "./session-wizard-helpers";

type OralRecorderPanelProps = {
  questionId: string;
  localTake: LocalVoiceTake | null;
  onTakeReady: (take: OralRecorderResult) => void;
  onDiscardLocal: () => void;
  disabled: boolean;
  /** When false, hide record / discard (replay only). */
  canRecordAgain: boolean;
};

export function OralRecorderPanel({
  questionId,
  localTake,
  onTakeReady,
  onDiscardLocal,
  disabled,
  canRecordAgain,
}: OralRecorderPanelProps) {
  const { phase, error, elapsedSec, start, stop } = useOralRecorder({
    onRecordingReady: onTakeReady,
  });

  const isRecording = phase === "recording";
  const preparing = phase === "stopped" && !localTake;

  return (
    <div className="space-y-4" data-question={questionId}>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {!localTake && !isRecording && !preparing ? (
        <div className="border-border/90 bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed sm:text-sm">
            {canRecordAgain
              ? "One continuous take — speak naturally, then stop when you are done. No pause or resume."
              : "You have used all takes for this prompt."}
          </p>
          <Button
            type="button"
            variant="default"
            className="w-full shrink-0 sm:w-auto sm:min-w-[10rem]"
            disabled={disabled || !canRecordAgain}
            onClick={() => void start()}
          >
            <Mic className="mr-2 size-4" aria-hidden />
            Start recording
          </Button>
        </div>
      ) : null}

      {preparing ? (
        <p className="text-muted-foreground bg-muted/30 border-border/70 rounded-lg border px-3 py-2.5 text-sm">
          Preparing playback…
        </p>
      ) : null}

      {isRecording ? (
        <div className="border-brand-navy-600/15 bg-muted/40 space-y-4 rounded-xl border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="bg-progress-fill size-2 shrink-0 animate-pulse rounded-full"
                aria-hidden
              />
              <span className="text-brand-navy-900 text-sm font-semibold tracking-tight">
                Recording
              </span>
            </div>
            <span className="text-muted-foreground font-mono tabular-nums text-sm">{elapsedSec}s</span>
          </div>
          <div className="bg-border/80 h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-progress-fill h-full w-2/5 animate-pulse rounded-full opacity-95"
              aria-hidden
            />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            When you are finished speaking, stop — you can listen back and save or re-record if you have attempts
            left.
          </p>
          <Button type="button" variant="secondary" className="w-full" disabled={disabled} onClick={() => stop()}>
            <Square className="mr-2 size-3.5 fill-current opacity-80" aria-hidden />
            Stop and review
          </Button>
        </div>
      ) : null}

      {localTake ? (
        <div className="border-border/80 bg-muted/20 space-y-3 rounded-xl border p-4 sm:p-5">
          <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
            Listen back before saving. You can discard and record again if you still have attempts left.
          </p>
          <audio
            className="bg-background border-border/60 w-full rounded-lg border"
            controls
            src={localTake.objectUrl}
            preload="metadata"
          />
          {canRecordAgain && !disabled ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onDiscardLocal()}>
              Discard and record again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
