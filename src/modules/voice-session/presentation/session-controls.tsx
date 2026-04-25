"use client";

import { Mic, MicOff, PauseCircle, PlayCircle, ScrollText, Square, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceSessionStatus } from "@/modules/voice-session/hooks/use-voice-session-machine";

type Props = {
  status: VoiceSessionStatus;
  isMicMuted: boolean;
  isAssistantPaused: boolean;
  onToggleMic: () => void;
  onToggleAssistant: () => void;
  onEndSession: () => void;
  onToggleTranscript: () => void;
  onConnect: () => void;
  onSimulateUserSpeech: () => void;
  onStopAssistant: () => void;
  onInterrupt: () => void;
  onResumeListening: () => void;
  canUseLiveControls: boolean;
};

export function SessionControls({
  status,
  isMicMuted,
  isAssistantPaused,
  onToggleMic,
  onToggleAssistant,
  onEndSession,
  onToggleTranscript,
  onConnect,
  onSimulateUserSpeech,
  onStopAssistant,
  onInterrupt,
  onResumeListening,
  canUseLiveControls,
}: Props) {
  const canConnect = status === "idle" || status === "error" || status === "interrupted";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" onClick={onToggleMic}>
          {isMicMuted ? <MicOff className="mr-2 size-4" aria-hidden /> : <Mic className="mr-2 size-4" aria-hidden />}
          {isMicMuted ? "Unmute mic" : "Mute mic"}
        </Button>
        <Button type="button" variant="outline" onClick={onToggleAssistant}>
          {isAssistantPaused ? (
            <PlayCircle className="mr-2 size-4" aria-hidden />
          ) : (
            <PauseCircle className="mr-2 size-4" aria-hidden />
          )}
          {isAssistantPaused ? "Resume assistant" : "Pause assistant"}
        </Button>
        <Button type="button" variant="outline" onClick={onToggleTranscript}>
          <ScrollText className="mr-2 size-4" aria-hidden />
          Transcript
        </Button>
        <Button type="button" variant="destructive" onClick={onEndSession}>
          <Square className="mr-2 size-3.5 fill-current" aria-hidden />
          End session
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={onConnect} disabled={!canConnect}>
          {status === "error" || status === "interrupted" ? "Retry connect" : "Connect"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onSimulateUserSpeech}>
          <WandSparkles className="mr-2 size-3.5" aria-hidden />
          Simulate user speech
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onStopAssistant} disabled={!canUseLiveControls}>
          Stop assistant speech
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onInterrupt} disabled={!canUseLiveControls}>
          Interrupt
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onResumeListening} disabled={!canUseLiveControls}>
          Resume listening
        </Button>
      </div>
    </div>
  );
}

