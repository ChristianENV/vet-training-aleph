import { beforeEach, describe, expect, it, vi } from "vitest";

const mem = {
  events: [] as Array<Record<string, unknown>>,
  turns: [] as Array<Record<string, unknown>>,
};

function resetMem() {
  mem.events = [];
  mem.turns = [];
}

vi.mock("@/lib/db/prisma", () => {
  const prisma = {
    sessionEvent: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where?.sessionId_clientEventId;
        if (!key) return null;
        return (
          mem.events.find(
            (e) => e.sessionId === key.sessionId && e.clientEventId === key.clientEventId,
          ) ?? null
        );
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        const rows = mem.events.filter((e) =>
          where?.type ? e.sessionId === where.sessionId && e.type === where.type : e.sessionId === where.sessionId,
        );
        if (!rows.length) return null;
        if (orderBy?.sequence === "desc") return rows.sort((a, b) => Number(b.sequence) - Number(a.sequence))[0];
        return rows[0];
      }),
    },
    sessionTurn: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where?.sessionId_clientTurnId;
        if (!key) return null;
        return (
          mem.turns.find(
            (t) => t.sessionId === key.sessionId && t.clientTurnId === key.clientTurnId,
          ) ?? null
        );
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let rows = mem.turns.filter((t) => t.sessionId === where.sessionId);
        if (where?.speaker) rows = rows.filter((t) => t.speaker === where.speaker);
        if (where?.isFinal != null) rows = rows.filter((t) => t.isFinal === where.isFinal);
        if (where?.sourceClientEventId) {
          rows = rows.filter((t) => t.sourceClientEventId === where.sourceClientEventId);
        }
        if (!rows.length) return null;
        if (orderBy?.sequence === "desc") return rows.sort((a, b) => Number(b.sequence) - Number(a.sequence))[0];
        return rows[0];
      }),
    },
    $transaction: vi.fn(async (cb: any) => {
      const tx = {
        sessionEvent: {
          findFirst: prisma.sessionEvent.findFirst,
          create: vi.fn(async ({ data }: any) => {
            const row = {
              id: `evt-${mem.events.length + 1}`,
              sessionId: data.sessionId,
              type: data.type,
              clientEventId: data.clientEventId,
              payloadJson: data.payloadJson ?? null,
              sequence: data.sequence,
              createdAt: new Date("2026-04-22T00:00:00.000Z"),
            };
            mem.events.push(row);
            return row;
          }),
        },
        sessionTurn: {
          findFirst: prisma.sessionTurn.findFirst,
          create: vi.fn(async ({ data }: any) => {
            const row = {
              id: `turn-${mem.turns.length + 1}`,
              sessionId: data.sessionId,
              speaker: data.speaker,
              text: data.text,
              clientTurnId: data.clientTurnId,
              sourceClientEventId: data.sourceClientEventId,
              sequence: data.sequence,
              isFinal: data.isFinal,
              createdAt: new Date("2026-04-22T00:00:00.000Z"),
            };
            mem.turns.push(row);
            return row;
          }),
        },
      };
      return cb(tx);
    }),
  };
  return { prisma };
});

describe("session-repository idempotency", () => {
  beforeEach(() => {
    resetMem();
    vi.resetModules();
  });

  it("appendSessionEvent persists once and dedupes by clientEventId", async () => {
    const repo = await import("./session-repository");
    const first = await repo.appendSessionEvent({
      sessionId: "s1",
      type: "session.connected",
      clientEventId: "evt-1",
      payloadJson: { k: "v" },
    });
    const dup = await repo.appendSessionEvent({
      sessionId: "s1",
      type: "session.connected",
      clientEventId: "evt-1",
    });

    expect(first.deduped).toBe(false);
    expect(first.event.sequence).toBe(1);
    expect(dup.deduped).toBe(true);
    expect(dup.event.id).toBe(first.event.id);
    expect(mem.events).toHaveLength(1);
  });

  it("appendSessionTurn dedupes by clientTurnId and by repeated final text", async () => {
    const repo = await import("./session-repository");
    const first = await repo.appendSessionTurn({
      sessionId: "s1",
      speaker: "user",
      text: "I hear bowel sounds.",
      isFinal: true,
      clientTurnId: "turn-1",
      sourceClientEventId: "evt-1",
    });
    const dupById = await repo.appendSessionTurn({
      sessionId: "s1",
      speaker: "user",
      text: "I hear bowel sounds.",
      isFinal: true,
      clientTurnId: "turn-1",
      sourceClientEventId: "evt-1",
    });
    const dupByFinalText = await repo.appendSessionTurn({
      sessionId: "s1",
      speaker: "user",
      text: " I hear bowel sounds. ",
      isFinal: true,
      sourceClientEventId: "evt-2",
    });

    expect(first.deduped).toBe(false);
    expect(dupById.deduped).toBe(true);
    expect(dupByFinalText.deduped).toBe(true);
    expect(mem.turns).toHaveLength(1);
  });

  it("stores sourceClientEventId and keeps event/turn sequence monotonic", async () => {
    const repo = await import("./session-repository");
    await repo.appendSessionEvent({ sessionId: "s1", type: "a", clientEventId: "e1" });
    await repo.appendSessionEvent({ sessionId: "s1", type: "b", clientEventId: "e2" });
    const t1 = await repo.appendSessionTurn({
      sessionId: "s1",
      speaker: "assistant",
      text: "turn 1",
      isFinal: true,
      sourceClientEventId: "e1",
    });
    const t2 = await repo.appendSessionTurn({
      sessionId: "s1",
      speaker: "assistant",
      text: "turn 2",
      isFinal: true,
      sourceClientEventId: "e2",
    });

    expect(mem.events.map((e) => e.sequence)).toEqual([1, 2]);
    expect(t1.turn.sourceClientEventId).toBe("e1");
    expect(t2.turn.sourceClientEventId).toBe("e2");
    expect(mem.turns.map((t) => t.sequence)).toEqual([1, 2]);
  });
});

