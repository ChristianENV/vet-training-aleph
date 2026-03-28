import { z } from "zod";

/** Persisted on SessionAnalysis and echoed in model JSON (enforced in prompt). */
export const ENRICHED_EVAL_SCHEMA_VERSION = "2026-03-27-oral-eval-enriched-v2" as const;
export const ENRICHED_EVAL_RESULT_KIND = "session_oral_assessment_enriched_v2" as const;

/** Model-facing readiness (distinct from Prisma `ReadinessLevel` on progress snapshots). */
export const oralReadinessLevelSchema = z.enum([
  "not_ready",
  "developing",
  "functional",
  "near_ready",
  "ready",
]);

export type OralReadinessLevel = z.infer<typeof oralReadinessLevelSchema>;

export const evidenceBasisSchema = z.enum([
  "transcript_only",
  "transcript_plus_timing_metadata",
  "audio_derived_features",
]);

export type EvidenceBasis = z.infer<typeof evidenceBasisSchema>;

/** Models sometimes omit subsection text; keep schema strict after coercion. */
const VET_SUBSECTION_FALLBACK =
  "No separate detail was provided for this area. See the communication overview and other sections of this report.";

function zRequiredTextWithEmptyFallback(maxLen: number) {
  return z.preprocess(
    (val: unknown) => {
      if (val === null || val === undefined) return VET_SUBSECTION_FALLBACK;
      if (typeof val === "string") {
        const t = val.trim();
        return t.length > 0 ? t : VET_SUBSECTION_FALLBACK;
      }
      if (typeof val === "number" || typeof val === "boolean") return String(val);
      return VET_SUBSECTION_FALLBACK;
    },
    z.string().min(1).max(maxLen),
  );
}

const scoringPillarSchema = z.object({
  /** Null when the model cannot score this pillar reliably from available evidence. */
  score: z.number().min(0).max(100).nullable(),
  headline: z.string().min(1).max(600),
  detail: z.string().min(1).max(2500).optional().nullable(),
});

/**
 * Structured output from the session evaluation model (enriched oral assessment).
 * Must stay compatible with `payloadJson.evaluation` in SessionAnalysis.
 */
export const sessionEvaluationOutputSchema = z.object({
  schemaVersion: z.string().min(1).max(120),
  resultKind: z.string().min(1).max(120),
  language: z.string().min(2).max(32),
  readinessLevel: oralReadinessLevelSchema,
  sessionSummary: z.string().min(1).max(4500),
  scoring: z.object({
    speaking: scoringPillarSchema,
    languageControl: scoringPillarSchema,
    veterinaryCommunication: scoringPillarSchema,
  }),
  audioAndDelivery: z.object({
    evidenceBasis: evidenceBasisSchema,
    /** Honest note on what was/was not observed (transcript vs timing vs true audio analysis). */
    transcriptVsAudioNote: z.string().min(1).max(2500),
    /** Null unless genuine pronunciation signal exists — never invent from text alone. */
    pronunciationScore: z.number().min(0).max(100).nullable(),
    /** Null unless computed from reliable timing/audio features; not from transcript guesswork. */
    estimatedPaceWpm: z.number().min(0).max(400).nullable(),
    deliveryStrengths: z.array(z.string().min(1)).max(12),
    deliveryGrowthAreas: z.array(z.string().min(1)).max(12),
  }),
  grammarAndLanguage: z.object({
    overview: z.string().min(1).max(3500),
    strengths: z.array(z.string().min(1)).max(12),
    recurringMistakes: z.array(
      z.object({
        pattern: z.string().min(1).max(600),
        exampleQuotes: z.array(z.string().min(1)).max(6),
        correction: z.string().min(1).max(2000),
      }),
    ).max(18),
    priorityFixes: z.array(z.string().min(1)).max(12),
  }),
  veterinaryCommunication: z.object({
    overview: z.string().min(1).max(3500),
    clientSafetyAndTone: zRequiredTextWithEmptyFallback(2500),
    technicalVsPlainLanguage: zRequiredTextWithEmptyFallback(2500),
    usPracticeNorms: z.array(z.string().min(1)).max(14),
  }),
  perQuestionFeedback: z.array(
    z.object({
      ordinal: z.number().int().min(1).max(99),
      promptSnippet: z.string().max(400).nullable().optional(),
      whatWorked: z.string().min(1).max(2500),
      coachNotes: z.string().min(1).max(3000),
      improvedExample: z.string().max(3500).nullable().optional(),
    }),
  ).min(1).max(25),
  actionPlan: z.object({
    nextSessionFocus: z.array(z.string().min(1)).max(12),
    practiceDrills: z.array(z.string().min(1)).max(12),
    onePriorityChange: z.string().min(1).max(2000),
  }),
  confidenceAndLimits: z.object({
    confidenceLevel: z.enum(["low", "medium", "high"]),
    summary: z.string().min(1).max(2500),
    limitations: z.array(z.string().min(1)).max(18),
  }),
});

export type SessionEvaluationOutput = z.infer<typeof sessionEvaluationOutputSchema>;
