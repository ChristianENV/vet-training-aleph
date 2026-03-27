import {
  sessionEvaluationOutputSchema,
  type SessionEvaluationOutput,
} from "@/modules/openai/schemas/session-evaluation-output";

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

  const result = sessionEvaluationOutputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `Schema validation failed: ${result.error.message}`,
    };
  }

  return { ok: true, data: result.data };
}

export type { SessionEvaluationOutput };
