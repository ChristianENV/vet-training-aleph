import { describe, expect, it } from "vitest";
import { initialVoiceSessionState, voiceSessionReducer } from "./use-voice-session-machine";

describe("useVoiceSessionMachine reducer", () => {
  it("supports interrupted -> connecting retry path", () => {
    const interrupted = { ...initialVoiceSessionState, status: "interrupted" as const };
    const next = voiceSessionReducer(interrupted, { type: "CONNECT_REQUESTED" });
    expect(next.status).toBe("connecting");
  });

  it("keeps save/completed/error transitions stable", () => {
    const listening = { ...initialVoiceSessionState, status: "listening" as const };
    const saving = voiceSessionReducer(listening, { type: "SAVE_REQUESTED" });
    const completed = voiceSessionReducer(saving, { type: "SAVE_SUCCEEDED" });
    expect(saving.status).toBe("saving");
    expect(completed.status).toBe("completed");

    const bad = voiceSessionReducer(completed, { type: "USER_STARTED_SPEAKING" });
    expect(bad.status).toBe("error");
    expect(bad.lastError).toContain("Invalid transition");
  });

  it("ignores duplicate safe events instead of erroring", () => {
    const connecting = { ...initialVoiceSessionState, status: "connecting" as const };
    const ignored = voiceSessionReducer(connecting, { type: "CONNECT_REQUESTED" });
    expect(ignored.status).toBe("connecting");
    expect(ignored.ignoredEvents).toBe(1);
  });
});

