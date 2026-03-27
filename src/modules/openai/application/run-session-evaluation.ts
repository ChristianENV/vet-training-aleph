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

/**
 * Calls OpenAI once, returns raw text + validated structured evaluation.
 * All side effects stay outside this module (callers persist to DB).
 */
export async function runSessionEvaluationModel(input: {
  sessionTitle: string | null;
  templateTitle: string | null;
  sessionType: string;
  items: EvaluationQaItem[];
}): Promise<{ rawText: string; evaluation: SessionEvaluationOutput }> {
  const qaLines = input.items.map((item) => {
    const answer =
      item.transcriptText?.trim() ||
      (item.audioUrl?.trim() ? `[Audio reference: ${item.audioUrl}]` : "(empty)");
    const dur = item.durationSec != null ? ` · recorded ${item.durationSec}s` : "";
    return `[${item.ordinal}] Question: ${item.promptText}\nLearner response${dur}: ${answer}`;
  });

  const userMessage = buildSessionEvaluationUserMessage({
    sessionTitle: input.sessionTitle,
    templateTitle: input.templateTitle,
    sessionType: input.sessionType,
    qaLines,
  });

  const client = createOpenAIClient();
  const model = getEvalModelName();

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: 4096,
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

  return { rawText, evaluation: parsed.data };
}
