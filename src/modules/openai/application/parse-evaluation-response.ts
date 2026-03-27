import {
  sessionEvaluationOutputSchema,
  type SessionEvaluationOutput,
} from "@/modules/openai/schemas/session-evaluation-output";
import { ReadinessLevel } from "@/generated/prisma/enums";

/**
 * Extract JSON object from model text (handles optional ```json fences).
 */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return trimmed;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeReadiness(value: unknown): ReadinessLevel | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase().replaceAll(" ", "_");
  if (
    normalized === ReadinessLevel.FOUNDATION ||
    normalized === ReadinessLevel.DEVELOPING ||
    normalized === ReadinessLevel.PROFICIENT ||
    normalized === ReadinessLevel.WORK_READY
  ) {
    return normalized;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return items.length ? items : undefined;
}

/**
 * Handles common model variations: nested `scores`, snake_case fields, numeric strings,
 * and empty/missing arrays by filling safe fallback content.
 */
function normalizeEvaluationShape(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = parsed as Record<string, unknown>;
  const scores =
    obj.scores && typeof obj.scores === "object" ? (obj.scores as Record<string, unknown>) : undefined;

  const overallScore = firstNumber(
    obj.overallScore,
    obj.overall_score,
    obj.totalScore,
    obj.total_score,
    scores?.overallScore,
    scores?.overall_score,
  );
  const fluencyScore = firstNumber(obj.fluencyScore, obj.fluency_score, scores?.fluencyScore, scores?.fluency_score);
  const technicalAccuracyScore = firstNumber(
    obj.technicalAccuracyScore,
    obj.technical_accuracy_score,
    scores?.technicalAccuracyScore,
    scores?.technical_accuracy_score,
  );
  const clientCommunicationScore = firstNumber(
    obj.clientCommunicationScore,
    obj.client_communication_score,
    scores?.clientCommunicationScore,
    scores?.client_communication_score,
  );
  const professionalismScore = firstNumber(
    obj.professionalismScore,
    obj.professionalism_score,
    scores?.professionalismScore,
    scores?.professionalism_score,
  );
  const confidenceScore = firstNumber(
    obj.confidenceScore,
    obj.confidence_score,
    scores?.confidenceScore,
    scores?.confidence_score,
  );

  const summary =
    (typeof obj.summary === "string" && obj.summary.trim()) ||
    (typeof obj.overallFeedback === "string" && obj.overallFeedback.trim()) ||
    (typeof obj.feedback === "string" && obj.feedback.trim()) ||
    "Evaluation completed. Review detailed strengths, weaknesses, and recommendations.";

  return {
    overallScore,
    fluencyScore,
    technicalAccuracyScore,
    clientCommunicationScore,
    professionalismScore,
    confidenceScore,
    readinessLevel:
      normalizeReadiness(obj.readinessLevel) ??
      normalizeReadiness(obj.readiness_level) ??
      ReadinessLevel.DEVELOPING,
    strengths: asStringArray(obj.strengths) ?? ["Shows willingness to communicate in clinical scenarios."],
    weaknesses: asStringArray(obj.weaknesses) ?? ["Needs more precise and consistent clinical English phrasing."],
    recommendations:
      asStringArray(obj.recommendations) ?? ["Practice one full response per prompt with clearer structure."],
    summary,
  };
}

export function parseEvaluationJson(rawModelText: string):
  | { ok: true; data: SessionEvaluationOutput }
  | { ok: false; error: string } {
  let text: string;
  try {
    text = extractJsonObject(rawModelText);
  } catch {
    return { ok: false, error: "Could not extract JSON from model output" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Model output is not valid JSON" };
  }

  const result = sessionEvaluationOutputSchema.safeParse(normalizeEvaluationShape(parsed));
  if (!result.success) {
    return {
      ok: false,
      error: `Schema validation failed: ${result.error.message}`,
    };
  }

  return { ok: true, data: result.data };
}

export type { SessionEvaluationOutput };
