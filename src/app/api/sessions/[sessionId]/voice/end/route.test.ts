import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const endVoiceBackboneMock = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requirePermission: requirePermissionMock,
}));
vi.mock("@/modules/voice-session/application/voice-session-backbone-service", () => ({
  endVoiceBackbone: endVoiceBackboneMock,
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

const { SessionsServiceError } = await import("@/modules/sessions/application/session-service");

describe("POST /voice/end", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns success for first end call", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    endVoiceBackboneMock.mockResolvedValue({
      session: { id: "s1", status: "COMPLETED" },
      idempotentReplay: false,
      analysisHandoff: {
        route: "/api/sessions/s1/analysis/evaluate",
        autoTriggered: true,
        prepared: true,
        itemCount: 2,
        analysisId: "a1",
        outcome: "SUCCEEDED",
      },
    });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api") as any, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.idempotentReplay).toBe(false);
    expect(body.data.handoff.analysis.autoTriggered).toBe(true);
  });

  it("keeps deterministic replay-safe payload for repeated end", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    endVoiceBackboneMock.mockResolvedValue({
      session: { id: "s1", status: "COMPLETED" },
      idempotentReplay: true,
      analysisHandoff: {
        route: "/api/sessions/s1/analysis/evaluate",
        autoTriggered: false,
        prepared: true,
        itemCount: 0,
        analysisId: "a1",
        outcome: "SUCCEEDED",
      },
    });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api") as any, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      status: "ended",
      idempotentReplay: true,
      handoff: { analysis: { autoTriggered: false, analysisId: "a1", outcome: "SUCCEEDED" } },
    });
  });

  it("handles insufficient turn data safely", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    endVoiceBackboneMock.mockResolvedValue({
      session: { id: "s1", status: "COMPLETED" },
      idempotentReplay: false,
      analysisHandoff: {
        route: "/api/sessions/s1/analysis/evaluate",
        autoTriggered: false,
        prepared: false,
        itemCount: 0,
        analysisId: null,
        outcome: null,
      },
    });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api") as any, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const body = await res.json();
    expect(body.data.handoff.analysis.prepared).toBe(false);
  });

  it("maps service errors", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    endVoiceBackboneMock.mockRejectedValue(new SessionsServiceError(403, "forbidden", "FORBIDDEN"));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api") as any, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    expect(res.status).toBe(403);
  });
});

