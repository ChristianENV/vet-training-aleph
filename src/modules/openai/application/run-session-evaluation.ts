import { createOpenAIClient, getEvalModelName } from "@/modules/openai/infrastructure/openai-client";
import { parseEvaluationJson } from "@/modules/openai/application/parse-evaluation-response";
import type { SessionEvaluationOutput } from "@/modules/openai/schemas/session-evaluation-output";
import {
  buildSessionEvaluationUserMessage,
  SESSION_EVALUATION_SYSTEM_PROMPT,
} from "@/modules/openai/application/session-evaluation-prompt";

export type EvaluationQaItem = {
  ordinal: number;
  promptText: string;
  transcriptText: string | null;
  audioUrl: string | null;
  durationSec: number | null;
};

function buildEvidenceCapsule(items: EvaluationQaItem[], transcriptFallbackOrdinals: number[]): string {
  const lines: string[] = [
    "The model does not receive raw audio waveforms or server-stored audio files. Evaluation is based on text transcripts (and any support-field text merged into responses), plus optional per-answer duration in seconds.",
    "In 'Question-and-answer responses' below, learner answers that show real speech text are full transcripts. Do not claim transcripts are missing when that text is present (only the bracketed placeholder lines mean transcript was unavailable).",
    "Duration alone is not sufficient for precise pacing, pause patterns, or pronunciation. Unless true audio-derived features are explicitly listed in this message (they are not by default), set audioAndDelivery.evidenceBasis to transcript_only or transcript_plus_timing_metadata.",
    "Set pronunciationScore and estimatedPaceWpm to null unless reliable audio-derived metrics are provided below. Never infer pronunciation or fine-grained pacing from wording alone.",
  ];
  if (transcriptFallbackOrdinals.length > 0) {
    lines.push(
      `Written support notes were used instead of voice for some prompts (ordinals: ${transcriptFallbackOrdinals.join(", ")}). Weight limitations accordingly.`,
    );
  }
  lines.push("Per-prompt evidence:");
  for (const item of items) {
    const hasTx = !!item.transcriptText?.trim();
    const dur = item.durationSec != null ? `${item.durationSec}s recorded` : "no duration metadata";
    const audioNote = item.audioUrl?.trim()
      ? "final audio stored server-side (not attached for this evaluation)"
      : "no final audio reference";
    lines.push(
      `- Ordinal ${item.ordinal}: ${hasTx ? "transcript available" : "empty or missing transcript"} · ${dur} · ${audioNote}`,
    );
  }
  lines.push(
    'audio_derived_features: not supplied — do not claim acoustic measurements; keep pronunciationScore and estimatedPaceWpm null unless you state clearly they are unknown (null).',
  );
  return lines.join("\n");
}

/**
 * Calls OpenAI once, returns raw text + validated structured evaluation.
 * All side effects stay outside this module (callers persist to DB).
 */
export async function runSessionEvaluationModel(input: {
  sessionTitle: string | null;
  templateTitle: string | null;
  sessionType: string;
  items: EvaluationQaItem[];
  transcriptFallbackOrdinals: number[];
}): Promise<{
  rawText: string;
  evaluation: SessionEvaluationOutput;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
}> {
  const qaLines = input.items.map((item) => {
    const answer =
      item.transcriptText?.trim() ||
      (item.audioUrl?.trim() ? "[Voice answer recorded; transcript not available]" : "(empty)");
    const dur = item.durationSec != null ? ` · recorded ${item.durationSec}s` : "";
    return `[${item.ordinal}] Question: ${item.promptText}\nLearner response${dur}: ${answer}`;
  });

  const evidenceCapsule = buildEvidenceCapsule(input.items, input.transcriptFallbackOrdinals);

  const userMessage = buildSessionEvaluationUserMessage({
    sessionTitle: input.sessionTitle,
    templateTitle: input.templateTitle,
    sessionType: input.sessionType,
    qaLines,
    evidenceCapsule,
  });

  const client = createOpenAIClient();
  const model = getEvalModelName();

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SESSION_EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  if (!rawText.trim()) {
    throw new Error("Empty response from language model");
  }

  const parsed = parseEvaluationJson(rawText);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const u = completion.usage;
  const usage = {
    promptTokens: u?.prompt_tokens ?? null,
    completionTokens: u?.completion_tokens ?? null,
    totalTokens: u?.total_tokens ?? null,
  };

  return { rawText, evaluation: parsed.data, usage };
}
