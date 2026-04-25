"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SessionStatus } from "@/generated/prisma/enums";
import { LoadingState } from "@/components/shared/loading-state";
import { SessionStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionUser } from "@/hooks/use-session-user";
import { roleHasPermission } from "@/lib/auth/permissions";
import { fetchSessionDetail } from "@/modules/sessions/presentation/sessions-api";
import { useVoiceSessionUi } from "@/modules/voice-session/hooks/use-voice-session-ui";
import { ConnectionStatusPill } from "./connection-status-pill";
import { LiveCaptions } from "./live-captions";
import { SessionControls } from "./session-controls";
import { TranscriptDrawer } from "./transcript-drawer";
import { VoiceOrb } from "./voice-orb";

type Props = {
  sessionId: string;
};

export function VoiceSessionScreen({ sessionId }: Props) {
  const { data: auth } = useSessionUser();
  const role = auth?.user?.role;
  const actorId = auth?.user?.id;
  const canUse = role ? roleHasPermission(role, "sessions:use") : false;

  const sessionQuery = useQuery({
    queryKey: ["training-session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
  });

  const {
    machineState,
    micPermission,
    isListening,
    micActivityLevel,
    isAssistantPaused,
    isMicMuted,
    assistantPlaybackState,
    connectErrorType,
    isTranscriptOpen,
    liveCaption,
    turns,
    connect,
    simulateUserSpeech,
    stopAssistant,
    interrupt,
    resumeListening,
    endSession,
    toggleAssistantPaused,
    toggleMicMuted,
    toggleTranscriptOpen,
    closeTranscript,
  } = useVoiceSessionUi(sessionId);

  if (sessionQuery.isLoading) {
    return (
      <LoadingState
        layout="fullscreen"
        title="Loading voice session"
        description="We are preparing your session details."
        hint="This usually takes just a few seconds."
      />
    );
  }

  if (sessionQuery.isError || !sessionQuery.data?.session) {
    return (
      <Card className="max-w-lg border-dashed">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">Session unavailable</CardTitle>
          <CardDescription>
            {sessionQuery.error instanceof Error ? sessionQuery.error.message : "Could not load this session."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/sessions">
            <Button variant="outline" type="button">
              Back to sessions
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const session = sessionQuery.data.session;
  const isOwner = !!(actorId && session.userId === actorId);
  const canAccessVoice = canUse && isOwner;

  if (!canAccessVoice) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-tight">
            Voice session is only available to the session owner
          </CardTitle>
          <CardDescription>
            Your account can view this session, but the voice-first experience is restricted for mutation safety.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/sessions/${sessionId}`}>
            <Button variant="outline" type="button">
              Open classic session screen
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const supportsVoiceUi = session.status === SessionStatus.ACTIVE || session.status === SessionStatus.DRAFT;
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const controlsLocked =
    machineState.status === "saving" || machineState.status === "completed" || machineState.status === "connecting";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{session.title ?? "Voice session"}</h2>
          <p className="text-muted-foreground text-sm">
            Realtime voice session. Existing wizard flow remains available.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionStatusPill status={machineState.status} />
          <SessionStatusBadge status={session.status} />
        </div>
      </div>

      {!supportsVoiceUi ? (
        <Card className="border-warning-500/25 bg-warning-100/80">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight">
              Session status is not active for voice mode
            </CardTitle>
            <CardDescription>
              Voice scaffold is intended for draft or active sessions during Phase 1.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/sessions/${sessionId}`}>
              <Button variant="outline" type="button">
                Return to classic session page
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-8 sm:px-8">
            <VoiceOrb status={machineState.status} micActivityLevel={micActivityLevel} />
          </section>

          <LiveCaptions text={liveCaption} turn={lastTurn} />

          <p className="text-muted-foreground text-xs">
            Mic: {micPermission} · Listening: {isListening ? "on" : "off"} · Assistant: {assistantPlaybackState}
          </p>

          {machineState.status === "interrupted" ? (
            <p className="border-warning-500/30 bg-warning-100/80 rounded-lg border px-3 py-2 text-sm">
              Realtime transport interrupted. Use <strong>Retry connect</strong> to resume this session safely.
            </p>
          ) : null}

          {machineState.lastError ? (
            <p className="text-destructive border-destructive/20 bg-error-100/70 rounded-lg border px-3 py-2 text-sm">
              {machineState.lastError}
              {connectErrorType !== "none" ? ` (type: ${connectErrorType})` : ""}
            </p>
          ) : null}

          <SessionControls
            status={machineState.status}
            isMicMuted={isMicMuted}
            isAssistantPaused={isAssistantPaused}
            onToggleMic={toggleMicMuted}
            onToggleAssistant={toggleAssistantPaused}
            onEndSession={() => void endSession()}
            onToggleTranscript={toggleTranscriptOpen}
            onConnect={() => void connect()}
            onSimulateUserSpeech={simulateUserSpeech}
            onStopAssistant={stopAssistant}
            onInterrupt={() => void interrupt()}
            onResumeListening={resumeListening}
            canUseLiveControls={isListening && !controlsLocked}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/sessions/${sessionId}`}>
          <Button variant="outline" type="button">
            Open classic session
          </Button>
        </Link>
        <Link href="/sessions">
          <Button variant="ghost" type="button">
            Back to sessions
          </Button>
        </Link>
      </div>

      <TranscriptDrawer open={isTranscriptOpen} turns={turns} onClose={closeTranscript} />
    </div>
  );
}

