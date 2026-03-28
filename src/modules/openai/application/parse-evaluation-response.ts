import {
  ENRICHED_EVAL_RESULT_KIND,
  ENRICHED_EVAL_SCHEMA_VERSION,
  sessionEvaluationOutputSchema,
  type OralReadinessLevel,
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

function deepSnakeToCamel(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(deepSnakeToCamel);
  }
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = deepSnakeToCamel(v);
  }
  return out;
}

function normalizeReadiness(value: unknown): OralReadinessLevel | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase().replace(/\s+/g, "_");
  const allowed: OralReadinessLevel[] = [
    "not_ready",
    "developing",
    "functional",
    "near_ready",
    "ready",
  ];
  if (allowed.includes(s as OralReadinessLevel)) return s as OralReadinessLevel;
  const up = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (up === "FOUNDATION") return "not_ready";
  if (up === "DEVELOPING") return "developing";
  if (up === "PROFICIENT") return "functional";
  if (up === "WORK_READY") return "ready";
  return undefined;
}

function normalizeEvidenceBasis(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    transcript_only: "transcript_only",
    transcript_plus_timing_metadata: "transcript_plus_timing_metadata",
    transcript_plus_timing: "transcript_plus_timing_metadata",
    audio_derived_features: "audio_derived_features",
    audio_features: "audio_derived_features",
  };
  return map[s] ?? (s in map ? s : undefined);
}

function normalizeConfidenceLevel(value: unknown): "low" | "medium" | "high" | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim().toLowerCase();
  if (s === "low" || s === "medium" || s === "high") return s;
  return undefined;
}

/**
 * Coerce common model quirks before Zod validation.
 */
function normalizeEvaluationShape(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  let obj = deepSnakeToCamel(parsed) as Record<string, unknown>;

  const wrapped = obj.evaluation;
  if (wrapped && typeof wrapped === "object" && !obj.sessionSummary) {
    obj = { ...(wrapped as Record<string, unknown>) };
  }

  obj.schemaVersion = typeof obj.schemaVersion === "string" && obj.schemaVersion.trim()
    ? obj.schemaVersion.trim()
    : ENRICHED_EVAL_SCHEMA_VERSION;
  obj.resultKind = typeof obj.resultKind === "string" && obj.resultKind.trim()
    ? obj.resultKind.trim()
    : ENRICHED_EVAL_RESULT_KIND;

  const rl = normalizeReadiness(obj.readinessLevel);
  if (rl) obj.readinessLevel = rl;

  const audio = obj.audioAndDelivery;
  if (audio && typeof audio === "object") {
    const a = audio as Record<string, unknown>;
    const eb = normalizeEvidenceBasis(a.evidenceBasis);
    if (eb) a.evidenceBasis = eb;
  }

  const conf = obj.confidenceAndLimits;
  if (conf && typeof conf === "object") {
    const c = conf as Record<string, unknown>;
    const cl = normalizeConfidenceLevel(c.confidenceLevel);
    if (cl) c.confidenceLevel = cl;
  }

  return obj;
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

  const normalized = normalizeEvaluationShape(parsed);
  const result = sessionEvaluationOutputSchema.safeParse(normalized);
  if (!result.success) {
    return {
      ok: false,
      error: `Schema validation failed: ${result.error.message}`,
    };
  }

  return { ok: true, data: result.data };
}

export type { SessionEvaluationOutput };
