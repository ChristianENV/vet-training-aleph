"use client";

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="default"
            className="w-full sm:w-auto"
            disabled={disabled || !canRecordAgain}
            onClick={() => void start()}
          >
            Start recording
          </Button>
          {!canRecordAgain ? (
            <p className="text-muted-foreground text-xs">You have used all takes for this prompt.</p>
          ) : (
            <p className="text-muted-foreground text-xs">One continuous take — no pause or resume.</p>
          )}
        </div>
      ) : null}

      {preparing ? (
        <p className="text-muted-foreground text-sm">Preparing playback…</p>
      ) : null}

      {isRecording ? (
        <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-destructive text-sm font-medium">Recording</span>
            <span className="text-muted-foreground tabular-nums text-sm">{elapsedSec}s</span>
          </div>
          <div className="bg-muted-foreground/25 h-1.5 w-full overflow-hidden rounded-full">
            <div className="bg-destructive h-full w-2/5 animate-pulse rounded-full" aria-hidden />
          </div>
          <Button type="button" variant="secondary" className="w-full" disabled={disabled} onClick={() => stop()}>
            Stop and review
          </Button>
        </div>
      ) : null}

      {localTake ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Listen back before saving. You can replace your take if you still have attempts left.
          </p>
          <audio className="w-full" controls src={localTake.objectUrl} preload="metadata" />
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
