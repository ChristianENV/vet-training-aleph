"use client";

import { Badge } from "@/components/ui/badge";
import type { VoiceSessionStatus } from "@/modules/voice-session/hooks/use-voice-session-machine";

type Props = {
  status: VoiceSessionStatus;
};

const LABEL_BY_STATUS: Record<VoiceSessionStatus, string> = {
  idle: "Idle",
  connecting: "Connecting",
  listening: "Listening",
  user_speaking: "User speaking",
  processing: "Processing",
  assistant_speaking: "Assistant speaking",
  interrupted: "Interrupted",
  saving: "Saving",
  completed: "Completed",
  error: "Error",
};

const VARIANT_BY_STATUS: Record<
  VoiceSessionStatus,
  "secondary" | "warning" | "progress" | "success" | "destructive" | "outline"
> = {
  idle: "outline",
  connecting: "progress",
  listening: "success",
  user_speaking: "progress",
  processing: "warning",
  assistant_speaking: "secondary",
  interrupted: "warning",
  saving: "progress",
  completed: "success",
  error: "destructive",
};

export function ConnectionStatusPill({ status }: Props) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{LABEL_BY_STATUS[status]}</Badge>;
}

