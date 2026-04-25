import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisStatus } from "@/generated/prisma/enums";
import { VOICE_EVENT_TYPES } from "@/modules/voice-session/domain/voice-event-types";

const getSessionByIdOrThrowMock = vi.fn();
const createRealtimeSessionBootstrapMock = vi.fn();
const triggerVoiceSessionAnalysisMock = vi.fn();
const analysisRepoMock = {
  findLatestAnalysisBySessionId: vi.fn(),
};
const sessionRepoMock = {
  appendSessionEvent: vi.fn(),
  listSessionTurns: vi.fn(),
  listSessionEvents: vi.fn(),
  appendSessionTurn: vi.fn(),
  findSessionTurnBySourceClientEventId: vi.fn(),
  findLatestSessionEventByType: vi.fn(),
  mergeSessionFinalizationMeta: vi.fn(),
};

vi.mock("@/modules/sessions/application/session-service", () => ({
  getSessionByIdOrThrow: getSessionByIdOrThrowMock,
  SessionsServiceError: class SessionsServiceError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly code?: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/modules/openai/application/create-realtime-session-bootstrap", () => ({
  createRealtimeSessionBootstrap: createRealtimeSessionBootstrapMock,
}));
vi.mock("./voice-session-analysis-handoff", () => ({
  triggerVoiceSessionAnalysis: triggerVoiceSessionAnalysisMock,
}));
vi.mock("@/modules/analyses/infrastructure/session-analysis-repository", () => analysisRepoMock);
vi.mock("@/modules/sessions/infrastructure/session-repository", () => sessionRepoMock);

describe("voice-session backbone service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionByIdOrThrowMock.mockResolvedValue({ id: "s1", userId: "u1", title: "Voice" });
  });

  it("connect returns backend-first hydrated history in stable order", async () => {
    createRealtimeSessionBootstrapMock.mockResolvedValue({
      clientSecret: "ek",
      model: "gpt-realtime",
      voice: "alloy",
      expiresAt: "2026-04-22T12:00:00.000Z",
      instructions: null,
    });
    sessionRepoMock.listSessionTurns.mockResolvedValue([
      { id: "t1", sequence: 1 },
      { id: "t2", sequence: 2 },
    ]);
    sessionRepoMock.listSessionEvents.mockResolvedValue([
      { id: "e1", sequence: 1 },
      { id: "e2", sequence: 2 },
    ]);
    const { connectVoiceBackbone } = await import("./voice-session-backbone-service");
    const out = await connectVoiceBackbone({ id: "u1" } as any, "s1");

    expect(out.turns.map((t: any) => t.sequence)).toEqual([1, 2]);
    expect(out.events.map((e: any) => e.sequence)).toEqual([1, 2]);
    const eventTypes = sessionRepoMock.appendSessionEvent.mock.calls.map((c) => c[0].type);
    expect(eventTypes).toContain(VOICE_EVENT_TYPES.SESSION_CONNECT_REQUESTED);
    expect(eventTypes).toContain(VOICE_EVENT_TYPES.SESSION_BOOTSTRAP_READY);
    expect(eventTypes).not.toContain(VOICE_EVENT_TYPES.SESSION_CONNECTED);
  });

  it("persistVoiceEvent dedupes replay and restores linked turn", async () => {
    sessionRepoMock.appendSessionEvent.mockResolvedValue({
      event: { id: "e1", sequence: 1, createdAt: new Date(), type: "x" },
      deduped: true,
    });
    sessionRepoMock.findSessionTurnBySourceClientEventId.mockResolvedValue({
      id: "t-existing",
      sourceClientEventId: "evt-1",
    });
    const { persistVoiceEvent } = await import("./voice-session-backbone-service");
    const out = await persistVoiceEvent(
      { id: "u1" } as any,
      "s1",
      { type: "transcript.final", clientEventId: "evt-1" },
      undefined,
    );
    expect(out.deduped).toBe(true);
    expect(out.savedTurn?.id).toBe("t-existing");
  });

  it("end is replay-safe and avoids duplicate uncontrolled work", async () => {
    sessionRepoMock.findLatestSessionEventByType.mockResolvedValue({ id: "ended" });
    analysisRepoMock.findLatestAnalysisBySessionId.mockResolvedValue({
      id: "a1",
      status: AnalysisStatus.COMPLETED,
    });
    sessionRepoMock.listSessionTurns.mockResolvedValue([]);
    const { endVoiceBackbone } = await import("./voice-session-backbone-service");
    const out = await endVoiceBackbone({ id: "u1" } as any, "s1");
    expect(out.idempotentReplay).toBe(true);
    expect(triggerVoiceSessionAnalysisMock).not.toHaveBeenCalled();
  });

  it("end triggers analysis once when enough turns exist", async () => {
    sessionRepoMock.findLatestSessionEventByType.mockResolvedValue(null);
    sessionRepoMock.listSessionTurns.mockResolvedValue([
      {
        id: "t1",
        speaker: "user",
        text: "final",
        isFinal: true,
        sequence: 1,
        createdAt: new Date("2026-04-22T12:00:00.000Z"),
      },
    ]);
    sessionRepoMock.appendSessionEvent.mockResolvedValue({
      event: { id: "evt", sequence: 1 },
      deduped: false,
    });
    triggerVoiceSessionAnalysisMock.mockResolvedValue({
      skipped: false,
      analysis: { id: "a1" },
      evaluationRun: { outcome: "SUCCEEDED" },
    });
    const { endVoiceBackbone } = await import("./voice-session-backbone-service");
    const out = await endVoiceBackbone({ id: "u1" } as any, "s1");
    expect(triggerVoiceSessionAnalysisMock).toHaveBeenCalledTimes(1);
    expect(out.analysisHandoff.analysisId).toBe("a1");
    expect(out.analysisHandoff.autoTriggered).toBe(true);
  });
});

