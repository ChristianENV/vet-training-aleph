export const VOICE_EVENT_TYPES = {
  SESSION_CONNECT_REQUESTED: "session.connect_requested",
  SESSION_BOOTSTRAP_READY: "session.bootstrap_ready",
  SESSION_CONNECTED: "session.connected",
  SESSION_CONNECT_FAILED: "session.connect_failed",
  SESSION_DISCONNECTED: "session.disconnected",
  SESSION_LISTENING: "session.listening",
  USER_SPEAKING_STARTED: "user.speaking.started",
  USER_SPEAKING_STOPPED: "user.speaking.stopped",
  ASSISTANT_SPEAKING_STARTED: "assistant.speaking.started",
  ASSISTANT_SPEAKING_STOPPED: "assistant.speaking.stopped",
  TRANSCRIPT_INTERIM: "transcript.interim",
  TRANSCRIPT_FINAL: "transcript.final",
  SESSION_ENDING: "session.ending",
  SESSION_ENDED: "session.ended",
  SESSION_TRANSPORT_INTERRUPTED: "session.transport_interrupted",
  SESSION_TRANSPORT_ERROR: "session.transport_error",
} as const;

export type VoiceEventType = (typeof VOICE_EVENT_TYPES)[keyof typeof VOICE_EVENT_TYPES];

