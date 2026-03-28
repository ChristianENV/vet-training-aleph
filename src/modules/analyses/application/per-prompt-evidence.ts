import type { ServerEnv } from "@/lib/config/env";
import { resolveSessionAudioPlaybackUrl } from "@/lib/storage/session-audio-playback-url";

export type PerPromptEvidenceDto = {
  ordinal: number;
  sessionQuestionId: string;
  promptText: string | null;
  transcriptText: string | null;
  audioPlaybackUrl: string | null;
  /** True when finalize used written-support scoring for this prompt (see session finalizationMetaJson). */
  usedWrittenNotesFallback: boolean;
  finalAudioMimeType: string | null;
  /** Voice file exists in storage; playback URL may still be null if the bucket is private. */
  hasStoredAudio: boolean;
};

function readTranscriptFallbackOrdinals(meta: unknown): Set<number> {
  if (!meta || typeof meta !== "object") return new Set();
  const o = meta as Record<string, unknown>;
  const arr = o.transcriptFallbackOrdinals;
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.filter((x): x is number => typeof x === "number"));
}

type ResponseRow = {
  sessionQuestionId: string;
  ordinal: number;
  transcriptText: string | null;
  finalAudioStorageKey: string | null;
  finalAudioProvider: string | null;
  finalAudioMimeType: string | null;
};

type QuestionRow = {
  id: string;
  ordinal: number;
  promptText: string;
};

/**
 * One row per session question (ordered), merged with the matching SessionResponse for playback + transcript.
 */
export function buildPerPromptEvidence(
  input: {
    finalizationMetaJson: unknown;
    sessionQuestions: QuestionRow[];
    responses: ResponseRow[];
  },
  env: ServerEnv,
): PerPromptEvidenceDto[] {
  const fallbackOrdinals = readTranscriptFallbackOrdinals(input.finalizationMetaJson);
  const byQuestionId = new Map(input.responses.map((r) => [r.sessionQuestionId, r]));

  const questions = [...input.sessionQuestions].sort((a, b) => a.ordinal - b.ordinal);

  return questions.map((q) => {
    const r = byQuestionId.get(q.id);
    return {
      ordinal: q.ordinal,
      sessionQuestionId: q.id,
      promptText: q.promptText ?? null,
      transcriptText: r?.transcriptText?.trim() ? r.transcriptText : null,
      audioPlaybackUrl: r
        ? resolveSessionAudioPlaybackUrl(env, {
            finalAudioStorageKey: r.finalAudioStorageKey,
            finalAudioProvider: r.finalAudioProvider,
          })
        : null,
      usedWrittenNotesFallback: fallbackOrdinals.has(q.ordinal),
      finalAudioMimeType: r?.finalAudioMimeType ?? null,
      hasStoredAudio: !!(r?.finalAudioStorageKey?.trim()),
    };
  });
}

type SessionSliceForEvidence = {
  finalizationMetaJson: unknown;
  sessionQuestions: QuestionRow[];
  responses: ResponseRow[];
};

/** Attach UI-ready per-prompt transcript + audio URLs (read model; not stored in payloadJson). */
export function enrichAnalysisWithPerPromptEvidence<
  T extends { session: SessionSliceForEvidence },
>(row: T, env: ServerEnv): T & { perPromptEvidence: PerPromptEvidenceDto[] } {
  const perPromptEvidence = buildPerPromptEvidence(
    {
      finalizationMetaJson: row.session.finalizationMetaJson,
      sessionQuestions: row.session.sessionQuestions,
      responses: row.session.responses,
    },
    env,
  );
  return { ...row, perPromptEvidence };
}
