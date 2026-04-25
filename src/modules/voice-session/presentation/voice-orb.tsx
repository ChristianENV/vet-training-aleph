"use client";

import { cn } from "@/lib/utils";
import type { VoiceSessionStatus } from "@/modules/voice-session/hooks/use-voice-session-machine";

type Props = {
  status: VoiceSessionStatus;
  micActivityLevel?: number;
};

function pulseClassForStatus(status: VoiceSessionStatus): string {
  switch (status) {
    case "user_speaking":
      return "scale-110 bg-brand-cyan-500/30";
    case "assistant_speaking":
      return "scale-105 bg-brand-navy-600/25";
    case "processing":
      return "scale-95 bg-warning-500/25";
    case "connecting":
      return "scale-100 bg-brand-cyan-500/20";
    case "error":
      return "scale-100 bg-destructive/20";
    default:
      return "scale-100 bg-brand-cyan-500/15";
  }
}

export function VoiceOrb({ status, micActivityLevel = 0 }: Props) {
  const animated = status !== "idle" && status !== "completed" && status !== "error";
  const activityScale = 1 + Math.min(0.2, micActivityLevel * 0.2);
  return (
    <div className="relative mx-auto flex size-56 items-center justify-center sm:size-64">
      <span
        className={cn(
          "absolute inset-0 rounded-full border border-brand-cyan-600/30 transition-all duration-500",
          pulseClassForStatus(status),
          animated && "animate-pulse",
        )}
        style={{ transform: `scale(${activityScale.toFixed(3)})` }}
        aria-hidden
      />
      <span
        className={cn(
          "absolute inset-5 rounded-full border border-brand-navy-600/20 bg-background/80 backdrop-blur-sm transition-all",
          animated && "animate-pulse",
        )}
        aria-hidden
      />
      <span className="text-brand-navy-900 relative text-sm font-semibold tracking-wide uppercase">
        Voice
      </span>
    </div>
  );
}

