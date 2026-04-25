import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const persistVoiceEventMock = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requirePermission: requirePermissionMock,
}));
vi.mock("@/modules/voice-session/application/voice-session-backbone-service", () => ({
  persistVoiceEvent: persistVoiceEventMock,
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

describe("POST /voice/events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("persists event+turn and returns stable payload", async () => {
    const now = new Date("2026-04-22T12:00:00.000Z");
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    persistVoiceEventMock.mockResolvedValue({
      deduped: false,
      savedEvent: {
        id: "evt1",
        type: "transcript.final",
        clientEventId: "ce1",
        payloadJson: { foo: "bar" },
        createdAt: now,
        sequence: 7,
      },
      savedTurn: {
        id: "turn1",
        speaker: "user",
        text: "hello",
        clientTurnId: "ct1",
        sourceClientEventId: "ce1",
        createdAt: now,
        sequence: 8,
        isFinal: true,
      },
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({
        eventId: "ce1",
        type: "transcript.final",
        occurredAt: now.toISOString(),
        payload: { foo: "bar" },
        turn: { speaker: "user", text: "hello", isFinal: true, clientTurnId: "ct1" },
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ sessionId: "s1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.duplicate).toBe(false);
    expect(body.data.sequence).toBe(7);
    expect(body.data.persistedTurn?.sourceClientEventId).toBe("ce1");
  });

  it("returns replay-safe duplicate response for same event id", async () => {
    const now = new Date("2026-04-22T12:00:00.000Z");
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    persistVoiceEventMock.mockResolvedValue({
      deduped: true,
      savedEvent: {
        id: "evt1",
        type: "session.connected",
        clientEventId: "ce1",
        payloadJson: {},
        createdAt: now,
        sequence: 2,
      },
      savedTurn: null,
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({
        eventId: "ce1",
        type: "session.connected",
        occurredAt: now.toISOString(),
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ sessionId: "s1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      acknowledged: true,
      duplicate: true,
      eventId: "ce1",
      eventType: "session.connected",
    });
  });

  it("returns auth response when permission gate fails", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false }), { status: 403 }),
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any, { params: Promise.resolve({ sessionId: "s1" }) });
    expect(res.status).toBe(403);
  });

  it("returns validation errors for malformed payload", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ type: "x" }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ sessionId: "s1" }) });
    expect(res.status).toBe(400);
  });

  it("maps service authorization errors", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, user: { id: "u1" } });
    persistVoiceEventMock.mockRejectedValue(
      new SessionsServiceError(403, "forbidden", "FORBIDDEN"),
    );
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({
        eventId: "ce1",
        type: "session.connected",
        occurredAt: "2026-04-22T12:00:00.000Z",
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ sessionId: "s1" }) });
    expect(res.status).toBe(403);
  });
});

