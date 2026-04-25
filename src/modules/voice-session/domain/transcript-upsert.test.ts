import { describe, expect, it } from "vitest";
import type { VoiceTranscriptTurn } from "./transcript-model";
import { upsertTranscriptTurn } from "./transcript-upsert";

const base = (overrides: Partial<VoiceTranscriptTurn>): VoiceTranscriptTurn => ({
  id: "t1",
  speaker: "user",
  text: "hello",
  createdAt: "2026-04-22T00:00:00.000Z",
  sequence: 1,
  isFinal: true,
  isInterim: false,
  ...overrides,
});

describe("upsertTranscriptTurn", () => {
  it("keeps final user/assistant turns unique across repeated callbacks", () => {
    const one = base({ id: "u-final", speaker: "user", text: "exam complete", sequence: 3 });
    const same = base({ id: "u-final", speaker: "user", text: "exam complete", sequence: 3 });
    const out = upsertTranscriptTurn(upsertTranscriptTurn([], one), same);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("exam complete");
  });

  it("upgrades interim with final turn state without duplication", () => {
    const interim = base({ id: "u1", text: "checking", isFinal: false, isInterim: true, sequence: 4 });
    const final = base({ id: "u1", text: "checking abdomen", isFinal: true, isInterim: false, sequence: 4 });
    const out = upsertTranscriptTurn(upsertTranscriptTurn([], interim), final);
    expect(out).toHaveLength(1);
    expect(out[0].isFinal).toBe(true);
    expect(out[0].text).toBe("checking abdomen");
  });

  it("preserves stable sequence ordering", () => {
    const t2 = base({ id: "t2", sequence: 2 });
    const t1 = base({ id: "t1", sequence: 1 });
    const out = upsertTranscriptTurn(upsertTranscriptTurn([], t2), t1);
    expect(out.map((t) => t.sequence)).toEqual([1, 2]);
  });
});

