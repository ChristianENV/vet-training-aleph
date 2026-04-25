"use client";

import { useMemo, useReducer } from "react";

export type VoiceSessionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "user_speaking"
  | "processing"
  | "assistant_speaking"
  | "interrupted"
  | "saving"
  | "completed"
  | "error";

export type VoiceSessionState = {
  status: VoiceSessionStatus;
  lastError: string | null;
  lastEventAt: number | null;
  ignoredEvents: number;
};

export type VoiceSessionEvent =
  | { type: "CONNECT_REQUESTED" }
  | { type: "CONNECT_SUCCEEDED" }
  | { type: "CONNECT_FAILED"; message: string }
  | { type: "USER_STARTED_SPEAKING" }
  | { type: "USER_STOPPED_SPEAKING" }
  | { type: "ASSISTANT_STARTED_SPEAKING" }
  | { type: "ASSISTANT_FINISHED_SPEAKING" }
  | { type: "INTERRUPT" }
  | { type: "RESUME_LISTENING" }
  | { type: "SAVE_REQUESTED" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "SAVE_FAILED"; message: string }
  | { type: "SESSION_COMPLETED" }
  | { type: "RESET" };

export const initialVoiceSessionState: VoiceSessionState = {
  status: "idle",
  lastError: null,
  lastEventAt: null,
  ignoredEvents: 0,
};

function canTransition(from: VoiceSessionStatus, to: VoiceSessionStatus): boolean {
  const transitions: Record<VoiceSessionStatus, VoiceSessionStatus[]> = {
    idle: ["connecting", "error"],
    connecting: ["listening", "error"],
    listening: ["user_speaking", "assistant_speaking", "interrupted", "saving", "error"],
    user_speaking: ["processing", "interrupted", "saving", "error"],
    processing: ["assistant_speaking", "listening", "interrupted", "error"],
    assistant_speaking: ["listening", "interrupted", "saving", "error"],
    interrupted: ["connecting", "listening", "processing", "saving", "error"],
    saving: ["completed", "error"],
    completed: ["idle"],
    error: ["idle", "connecting"],
  };
  return transitions[from].includes(to);
}

function transition(
  state: VoiceSessionState,
  nextStatus: VoiceSessionStatus,
  lastError: string | null = state.lastError,
): VoiceSessionState {
  if (!canTransition(state.status, nextStatus) && state.status !== nextStatus) {
    return {
      ...state,
      status: "error",
      lastError: `Invalid transition: ${state.status} -> ${nextStatus}`,
      lastEventAt: Date.now(),
    };
  }
  return {
    status: nextStatus,
    lastError,
    lastEventAt: Date.now(),
    ignoredEvents: state.ignoredEvents,
  };
}

/**
 * Duplicate and harmlessly-late events can happen in realtime transports.
 * We ignore those instead of forcing the session to error.
 */
function shouldIgnoreEvent(state: VoiceSessionState, event: VoiceSessionEvent): boolean {
  switch (event.type) {
    case "CONNECT_REQUESTED":
      return state.status === "connecting";
    case "CONNECT_SUCCEEDED":
      return state.status === "listening";
    case "USER_STARTED_SPEAKING":
      return state.status === "user_speaking" || state.status === "assistant_speaking";
    case "USER_STOPPED_SPEAKING":
      return state.status !== "user_speaking";
    case "ASSISTANT_STARTED_SPEAKING":
      return state.status === "assistant_speaking" || state.status === "user_speaking";
    case "ASSISTANT_FINISHED_SPEAKING":
      return state.status !== "assistant_speaking";
    case "RESUME_LISTENING":
      return state.status === "listening";
    case "SAVE_REQUESTED":
      return state.status === "saving" || state.status === "completed";
    case "SAVE_SUCCEEDED":
    case "SESSION_COMPLETED":
      return state.status === "completed";
    default:
      return false;
  }
}

function ignored(state: VoiceSessionState): VoiceSessionState {
  return {
    ...state,
    ignoredEvents: state.ignoredEvents + 1,
    lastEventAt: Date.now(),
  };
}

export function voiceSessionReducer(state: VoiceSessionState, event: VoiceSessionEvent): VoiceSessionState {
  if (shouldIgnoreEvent(state, event)) {
    return ignored(state);
  }

  switch (event.type) {
    case "CONNECT_REQUESTED":
      return transition(state, "connecting", null);
    case "CONNECT_SUCCEEDED":
      return transition(state, "listening", null);
    case "CONNECT_FAILED":
      return transition(state, "error", event.message);
    case "USER_STARTED_SPEAKING":
      return transition(state, "user_speaking");
    case "USER_STOPPED_SPEAKING":
      return transition(state, "processing");
    case "ASSISTANT_STARTED_SPEAKING":
      return transition(state, "assistant_speaking");
    case "ASSISTANT_FINISHED_SPEAKING":
      return transition(state, "listening");
    case "INTERRUPT":
      return transition(state, "interrupted");
    case "RESUME_LISTENING":
      return transition(state, "listening");
    case "SAVE_REQUESTED":
      return transition(state, "saving");
    case "SAVE_SUCCEEDED":
      return transition(state, "completed");
    case "SAVE_FAILED":
      return transition(state, "error", event.message);
    case "SESSION_COMPLETED":
      return transition(state, "completed");
    case "RESET":
      return { ...initialVoiceSessionState, lastEventAt: Date.now() };
    default:
      return state;
  }
}

export function useVoiceSessionMachine() {
  const [state, dispatch] = useReducer(voiceSessionReducer, initialVoiceSessionState);

  return useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state],
  );
}

