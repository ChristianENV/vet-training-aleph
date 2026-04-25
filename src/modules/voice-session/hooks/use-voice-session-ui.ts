"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createVoiceSessionService } from "@/modules/voice-session/application/voice-session-service";
import type { VoiceSessionEventPayload, VoiceTranscriptTurnDto } from "@/modules/voice-session/infrastructure/voice-session-api";
import { VOICE_EVENT_TYPES } from "@/modules/voice-session/domain/voice-event-types";
import { createTranscriptTurn, type VoiceTranscriptTurn } from "@/modules/voice-session/domain/transcript-model";
import { upsertTranscriptTurn } from "@/modules/voice-session/domain/transcript-upsert";
import { useRealtimeAudioIo } from "./use-realtime-audio-io";
import { OpenAiRealtimeClient } from "@/modules/voice-session/infrastructure/openai-realtime-client";
import { useVoiceSessionMachine } from "./use-voice-session-machine";

const INITIAL_TRANSCRIPT: VoiceTranscriptTurn[] = [
  {
    ...createTranscriptTurn({
      speaker: "assistant",
      text: "Voice session ready. Press Connect to begin.",
      isFinal: true,
    }),
  },
];

export function useVoiceSessionUi(sessionId: string) {
  const { state, dispatch } = useVoiceSessionMachine();
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [transcriptTurns, setTranscriptTurns] = useState<VoiceTranscriptTurn[]>(INITIAL_TRANSCRIPT);
  const [assistantPlaybackState, setAssistantPlaybackState] = useState<"idle" | "speaking" | "paused">("idle");
  const connectionIdRef = useRef<string | null>(null);
  const eventSeqRef = useRef(1);
  const realtimeRef = useRef<OpenAiRealtimeClient | null>(null);
  const connectedEventSentRef = useRef(false);
  const lastFinalBySpeakerRef = useRef<{ user: string; assistant: string }>({ user: "", assistant: "" });
  const [connectErrorType, setConnectErrorType] = useState<
    "none" | "permission" | "connect" | "transport" | "persistence"
  >("none");

  const audio = useRealtimeAudioIo();
  const service = useMemo(() => createVoiceSessionService({ useMockTransport: false }), []);

  const dtoToTurn = useCallback((t: VoiceTranscriptTurnDto): VoiceTranscriptTurn => {
    return {
      id: t.id,
      speaker: t.speaker,
      text: t.text,
      createdAt: t.createdAt,
      sequence: t.sequence,
      isFinal: t.isFinal,
      isInterim: !t.isFinal,
    };
  }, []);

  const upsertTurn = useCallback((turn: VoiceTranscriptTurn) => {
    setTranscriptTurns((prev) => upsertTranscriptTurn(prev, turn));
  }, []);

  const sendEvent = useCallback(
    async (
      type: VoiceSessionEventPayload["type"],
      payload?: Record<string, unknown>,
      turn?: VoiceSessionEventPayload["turn"],
    ) => {
      try {
        const eventId = `evt-${eventSeqRef.current++}`;
        return await service.sendEvent(sessionId, {
          eventId,
          type,
          occurredAt: new Date().toISOString(),
          connectionId: connectionIdRef.current,
          payload,
          turn,
        });
      } catch {
        setConnectErrorType("persistence");
        throw new Error("Could not persist voice session event.");
      }
    },
    [service, sessionId],
  );

  const connect = useCallback(async () => {
    dispatch({ type: "CONNECT_REQUESTED" });
    setConnectErrorType("none");
    try {
      const conn = await service.connect(sessionId);
      connectionIdRef.current = conn.connectionId;
      connectedEventSentRef.current = false;
      const hydratedTurns = conn.history.turns.map(dtoToTurn);
      setTranscriptTurns(hydratedTurns);
      const lastUser = [...hydratedTurns].reverse().find((t) => t.speaker === "user" && t.isFinal)?.text ?? "";
      const lastAssistant =
        [...hydratedTurns].reverse().find((t) => t.speaker === "assistant" && t.isFinal)?.text ?? "";
      lastFinalBySpeakerRef.current = { user: lastUser, assistant: lastAssistant };
      await audio.startListening();
      const micStream = audio.getMicStream();
      if (!micStream) {
        setConnectErrorType("permission");
        throw new Error("Microphone stream not available. Check browser permissions.");
      }

      const rt = new OpenAiRealtimeClient();
      realtimeRef.current = rt;
      await rt.connect({
        bootstrap: conn.bootstrap,
        micStream,
        callbacks: {
          onConnected: () => {
            dispatch({ type: "CONNECT_SUCCEEDED" });
            if (!connectedEventSentRef.current) {
              connectedEventSentRef.current = true;
              void sendEvent(VOICE_EVENT_TYPES.SESSION_CONNECTED, {
                connectionId: conn.connectionId,
              }).catch(() => {});
            }
          },
          onDisconnected: () => {
            setConnectErrorType("transport");
            dispatch({ type: "INTERRUPT" });
            void sendEvent(VOICE_EVENT_TYPES.SESSION_DISCONNECTED, {
              reason: "peer_closed",
            }).catch(() => {});
          },
          onTransportInterrupted: () => {
            setConnectErrorType("transport");
            dispatch({ type: "INTERRUPT" });
            void sendEvent(VOICE_EVENT_TYPES.SESSION_TRANSPORT_INTERRUPTED, {
              reason: "peer_connection_state_change",
            });
          },
          onError: (message) => {
            setConnectErrorType("transport");
            dispatch({ type: "CONNECT_FAILED", message });
            void sendEvent(VOICE_EVENT_TYPES.SESSION_TRANSPORT_ERROR, { message });
          },
          onUserTranscriptInterim: (text) => {
            setTranscriptTurns((prev) => {
              const latest = prev[prev.length - 1];
              if (latest && latest.speaker === "user" && latest.isInterim) {
                const next = [...prev];
                next[next.length - 1] = { ...latest, text };
                return next;
              }
              return [
                ...prev,
                createTranscriptTurn({ speaker: "user", text, isInterim: true, isFinal: false }),
              ];
            });
            dispatch({ type: "USER_STARTED_SPEAKING" });
          },
          onUserTranscriptFinal: (text) => {
            const clean = text.trim();
            if (!clean || clean === lastFinalBySpeakerRef.current.user) {
              return;
            }
            lastFinalBySpeakerRef.current.user = clean;
            dispatch({ type: "USER_STOPPED_SPEAKING" });
            void sendEvent(
              VOICE_EVENT_TYPES.TRANSCRIPT_FINAL,
              { speaker: "user" },
              { speaker: "user", text: clean, isFinal: true },
            )
              .then((res) => {
                if (res.persistedTurn) upsertTurn(dtoToTurn(res.persistedTurn));
              })
              .catch(() => {});
          },
          onAssistantTranscriptInterim: (text) => {
            dispatch({ type: "ASSISTANT_STARTED_SPEAKING" });
            setTranscriptTurns((prev) => {
              const latest = prev[prev.length - 1];
              if (latest && latest.speaker === "assistant" && latest.isInterim) {
                const next = [...prev];
                next[next.length - 1] = { ...latest, text };
                return next;
              }
              return [
                ...prev,
                createTranscriptTurn({ speaker: "assistant", text, isInterim: true, isFinal: false }),
              ];
            });
          },
          onAssistantTranscriptFinal: (text) => {
            const clean = text.trim();
            if (!clean || clean === lastFinalBySpeakerRef.current.assistant) {
              return;
            }
            lastFinalBySpeakerRef.current.assistant = clean;
            dispatch({ type: "ASSISTANT_FINISHED_SPEAKING" });
            void sendEvent(
              VOICE_EVENT_TYPES.TRANSCRIPT_FINAL,
              { speaker: "assistant" },
              { speaker: "assistant", text: clean, isFinal: true },
            )
              .then((res) => {
                if (res.persistedTurn) upsertTurn(dtoToTurn(res.persistedTurn));
              })
              .catch(() => {});
          },
          onAssistantSpeakingState: (speaking) => {
            setAssistantPlaybackState(speaking ? "speaking" : "idle");
            if (speaking) dispatch({ type: "ASSISTANT_STARTED_SPEAKING" });
            else dispatch({ type: "ASSISTANT_FINISHED_SPEAKING" });
          },
        },
      });

      await sendEvent(VOICE_EVENT_TYPES.SESSION_LISTENING);
    } catch (e) {
      if (connectErrorType === "none") setConnectErrorType("connect");
      if (connectionIdRef.current) {
        void sendEvent(VOICE_EVENT_TYPES.SESSION_CONNECT_FAILED, {
          connectionId: connectionIdRef.current,
          error: e instanceof Error ? e.message : "connect_failed",
        }).catch(() => {});
      }
      dispatch({
        type: "CONNECT_FAILED",
        message: e instanceof Error ? e.message : "Failed to connect voice session",
      });
    }
  }, [audio, connectErrorType, dispatch, dtoToTurn, sendEvent, service, sessionId, upsertTurn]);

  const simulateUserSpeech = useCallback(async () => {
    if (state.status !== "listening" || !realtimeRef.current) return;
    dispatch({ type: "USER_STARTED_SPEAKING" });
    await sendEvent(VOICE_EVENT_TYPES.USER_SPEAKING_STARTED, {
      micActivityLevel: Number(audio.micActivityLevel.toFixed(3)),
    });
    const interim = createTranscriptTurn({
      speaker: "user",
      text: "Good morning, this is Dr. Lee. Bella has had vomiting since last night...",
      isInterim: true,
      isFinal: false,
    });
    const interimRes = await sendEvent(
      VOICE_EVENT_TYPES.TRANSCRIPT_INTERIM,
      { speaker: "user" },
      {
        speaker: "user",
        text: interim.text,
        isFinal: false,
      },
    );
    if (interimRes?.persistedTurn) {
      upsertTurn(dtoToTurn(interimRes.persistedTurn));
    } else {
      upsertTurn(interim);
    }
    window.setTimeout(() => {
      dispatch({ type: "USER_STOPPED_SPEAKING" });
      void sendEvent(VOICE_EVENT_TYPES.USER_SPEAKING_STOPPED);
      setTranscriptTurns((prev) =>
        prev.map((t) =>
          t.id === interim.id
            ? {
                ...t,
                text: "Good morning, this is Dr. Lee. Bella has been vomiting since last night and has low appetite.",
                isInterim: false,
                isFinal: true,
              }
            : t,
        ),
      );
      void sendEvent(
        VOICE_EVENT_TYPES.TRANSCRIPT_FINAL,
        { speaker: "user" },
        {
          speaker: "user",
          text: "Good morning, this is Dr. Lee. Bella has been vomiting since last night and has low appetite.",
          isFinal: true,
        },
      );
      window.setTimeout(() => {
        dispatch({ type: "ASSISTANT_STARTED_SPEAKING" });
        void sendEvent(VOICE_EVENT_TYPES.ASSISTANT_SPEAKING_STARTED);
        realtimeRef.current?.sendClientEvent({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions:
              "Thanks. Ask when symptoms started, hydration status, and toxin exposure. Then summarize a plain-language plan.",
          },
        });
      }, 700);
    }, 1200);
  }, [audio, dispatch, dtoToTurn, sendEvent, state.status, upsertTurn]);

  const stopAssistant = useCallback(async () => {
    realtimeRef.current?.interruptAssistant();
    setAssistantPlaybackState("idle");
    dispatch({ type: "ASSISTANT_FINISHED_SPEAKING" });
    await sendEvent(VOICE_EVENT_TYPES.ASSISTANT_SPEAKING_STOPPED);
  }, [dispatch, sendEvent]);

  const interrupt = useCallback(async () => {
    dispatch({ type: "INTERRUPT" });
    realtimeRef.current?.interruptAssistant();
    setAssistantPlaybackState("idle");
    await sendEvent(VOICE_EVENT_TYPES.ASSISTANT_SPEAKING_STOPPED, { interruptedByUser: true });
    upsertTurn(
      createTranscriptTurn({
        speaker: "system",
        text: "Assistant interrupted. Tap Resume to continue listening.",
        isFinal: true,
      }),
    );
  }, [dispatch, sendEvent, upsertTurn]);

  const resumeListening = useCallback(() => {
    dispatch({ type: "RESUME_LISTENING" });
  }, [dispatch]);

  const endSession = useCallback(async () => {
    dispatch({ type: "SAVE_REQUESTED" });
    try {
      await sendEvent(VOICE_EVENT_TYPES.SESSION_ENDING);
      realtimeRef.current?.disconnect();
      audio.stopListening();
      const ended = await service.endSession(sessionId);
      dispatch({ type: "SAVE_SUCCEEDED" });
      upsertTurn(
        createTranscriptTurn({
          speaker: "system",
          text: ended.handoff.analysis.analysisId
            ? `Session ended. Analysis ${ended.handoff.analysis.analysisId} ${ended.handoff.analysis.outcome === "FAILED" ? "failed" : "is ready"}.`
            : ended.handoff.analysis.prepared && ended.handoff.analysis.itemCount > 0
              ? `Session ended. Analysis handoff prepared (${ended.handoff.analysis.itemCount} conversational items).`
              : "Session ended. Analysis handoff is not ready yet.",
          isFinal: true,
        }),
      );
    } catch (e) {
      dispatch({
        type: "SAVE_FAILED",
        message: e instanceof Error ? e.message : "Failed to end session",
      });
    }
  }, [audio, dispatch, sendEvent, service, sessionId, upsertTurn]);

  const toggleAssistantPaused = useCallback(() => {
    if (!realtimeRef.current) return;
    if (assistantPlaybackState === "speaking") {
      realtimeRef.current.pauseAssistantAudio();
      setAssistantPlaybackState("paused");
      return;
    }
    if (assistantPlaybackState === "paused") {
      realtimeRef.current.resumeAssistantAudio();
      setAssistantPlaybackState("speaking");
    }
  }, [assistantPlaybackState]);

  const liveCaption = useMemo(() => {
    if (state.status === "error") {
      return state.lastError ?? "Voice session failed.";
    }
    const latest = transcriptTurns[transcriptTurns.length - 1];
    if (!latest) return "Connect to begin voice session.";
    if (latest.isInterim) return latest.text;
    return latest.text;
  }, [state.lastError, state.status, transcriptTurns]);

  return {
    machineState: state,
    micPermission: audio.micPermission,
    isListening: audio.isListening,
    micActivityLevel: audio.micActivityLevel,
    isMicMuted: audio.isMicMuted,
    isAssistantPaused: assistantPlaybackState === "paused",
    assistantPlaybackState,
    connectErrorType,
    isTranscriptOpen,
    liveCaption,
    turns: transcriptTurns,
    connect,
    simulateUserSpeech,
    stopAssistant,
    interrupt,
    resumeListening,
    endSession,
    toggleMicMuted: audio.toggleMicMuted,
    toggleAssistantPaused,
    toggleTranscriptOpen: () => setIsTranscriptOpen((v) => !v),
    closeTranscript: () => setIsTranscriptOpen(false),
  };
}

