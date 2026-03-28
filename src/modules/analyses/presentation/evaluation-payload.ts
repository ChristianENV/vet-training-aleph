import {
  ENRICHED_EVAL_RESULT_KIND,
  sessionEvaluationOutputSchema,
  type SessionEvaluationOutput,
} from "@/modules/openai/schemas/session-evaluation-output";

const LEGACY_RESULT_KIND = "session_language_eval_v1";

/** Legacy flat evaluation stored under payloadJson.evaluation (pre-enriched). */
export type LegacySessionEvalV1 = {
  overallScore?: number;
  fluencyScore?: number;
  technicalAccuracyScore?: number;
  clientCommunicationScore?: number;
  professionalismScore?: number;
  confidenceScore?: number;
  readinessLevel?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
};

export function getAnalysisPayloadShape(payloadJson: unknown): "enriched_v2" | "legacy_v1" | "unknown" {
  if (!payloadJson || typeof payloadJson !== "object") return "unknown";
  const o = payloadJson as Record<string, unknown>;
  if (o.resultKind === ENRICHED_EVAL_RESULT_KIND) return "enriched_v2";
  if (o.resultKind === LEGACY_RESULT_KIND) return "legacy_v1";
  const ev = o.evaluation;
  if (ev && typeof ev === "object") {
    const e = ev as Record<string, unknown>;
    if (typeof e.sessionSummary === "string" && e.scoring && typeof e.scoring === "object") {
      return "enriched_v2";
    }
    if (typeof e.overallScore === "number" || typeof e.fluencyScore === "number") {
      return "legacy_v1";
    }
  }
  return "unknown";
}

export function readEnrichedEvaluation(payloadJson: unknown): SessionEvaluationOutput | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const ev = (payloadJson as Record<string, unknown>).evaluation;
  if (!ev || typeof ev !== "object") return null;
  const parsed = sessionEvaluationOutputSchema.safeParse(ev);
  return parsed.success ? parsed.data : null;
}

export function readLegacyEvaluationV1(payloadJson: unknown): LegacySessionEvalV1 | null {
  if (!payloadJson || typeof payloadJson !== "object") return null;
  const ev = (payloadJson as Record<string, unknown>).evaluation;
  if (!ev || typeof ev !== "object") return null;
  return ev as LegacySessionEvalV1;
}
