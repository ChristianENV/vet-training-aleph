import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const connectVoiceBackboneMock = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requirePermission: requirePermissionMock,
}));
vi.mock("@/modules/voice-session/application/voice-session-backbone-service", () => ({
  connectVoiceBackbone: connectVoiceBackboneMock,
}));
vi.mock("@/modules/sessions/application/session-service", () => ({
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

describe("POST /voice/connect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns backend-first history payload in stable sequence", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    connectVoiceBackboneMock.mockResolvedValue({
      session: { id: "s1", status: "ACTIVE" },
      connectionId: "voice_s1_123",
      bootstrap: {
        clientSecret: "ek",
        model: "gpt-realtime",
        voice: "alloy",
        expiresAt: "2026-04-22T12:00:00.000Z",
        instructions: null,
      },
      turns: [
        {
          id: "t1",
          speaker: "user",
          text: "a",
          clientTurnId: "ct1",
          sourceClientEventId: "e1",
          sequence: 1,
          isFinal: true,
          createdAt: new Date("2026-04-22T10:00:00.000Z"),
        },
      ],
      events: [
        {
          id: "e1",
          type: "session.connect_requested",
          clientEventId: "e1",
          payloadJson: {},
          sequence: 1,
          createdAt: new Date("2026-04-22T10:00:00.000Z"),
        },
      ],
    });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api") as any, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const body = await res.json();
    expect(body.data.status).toBe("bootstrap_ready");
    expect(body.data.history.turns[0].sequence).toBe(1);
    expect(body.data.history.events[0].sequence).toBe(1);
  });
});

