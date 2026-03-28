import { createOpenAIClient, getQuestionsModelName } from "@/modules/openai/infrastructure/openai-client";
import {
  buildSessionQuestionGenerationUserMessage,
  SESSION_QUESTION_GENERATION_SYSTEM,
} from "@/modules/openai/application/session-question-generation-prompt";
import {
  buildGeneratedQuestionsOutputSchema,
  type GeneratedQuestionsOutput,
} from "@/modules/openai/schemas/generated-questions-output";
import type { SessionType } from "@/generated/prisma/enums";

export type QuestionGenerationUsage = {
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  rawResponseSnippet: string | null;
};

/** Rough USD estimate for gpt-4o-mini tier; null if unknown model. */
export function estimateOpenAiMiniCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const m = model.toLowerCase();
  if (!m.includes("gpt-4o-mini") && !m.includes("gpt-4o_mini")) {
    return null;
  }
  const inPrice = 0.15 / 1_000_000;
  const outPrice = 0.6 / 1_000_000;
  return promptTokens * inPrice + completionTokens * outPrice;
}

/**
 * Only estimates cost when both prompt and completion token counts are present.
 * Avoids logging misleading $0 when the API omitted usage fields.
 */
export function estimateOpenAiMiniCostUsdFromUsage(
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  if (promptTokens == null || completionTokens == null) return null;
  return estimateOpenAiMiniCostUsd(model, promptTokens, completionTokens);
}

export async function runSessionQuestionGenerationModel(input: {
  templateTitle: string;
  templateSlug: string;
  sessionType: SessionType;
  templateDescription: string | null;
  priorPromptsSample: string[];
  questionCountMin: number;
  questionCountMax: number;
}): Promise<{ output: GeneratedQuestionsOutput; usage: QuestionGenerationUsage }> {
  const model = getQuestionsModelName();
  const outputSchema = buildGeneratedQuestionsOutputSchema(
    input.questionCountMin,
    input.questionCountMax,
  );

  const userMessage = buildSessionQuestionGenerationUserMessage({
    templateTitle: input.templateTitle,
    templateSlug: input.templateSlug,
    sessionType: input.sessionType,
    templateDescription: input.templateDescription,
    priorPromptsSample: input.priorPromptsSample,
    questionCountMin: input.questionCountMin,
    questionCountMax: input.questionCountMax,
  });

  const client = createOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.45,
    max_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SESSION_QUESTION_GENERATION_SYSTEM },
      { role: "user", content: userMessage },
    ],
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  const usage = completion.usage;
  const promptTokens = usage?.prompt_tokens ?? null;
  const completionTokens = usage?.completion_tokens ?? null;
  const totalTokens = usage?.total_tokens ?? null;

  if (!rawText.trim()) {
    throw new Error("Empty response from language model");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const parsed = outputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const msg = parsed.error.flatten();
    throw new Error(`Invalid question payload: ${JSON.stringify(msg)}`);
  }

  return {
    output: parsed.data,
    usage: {
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      rawResponseSnippet: rawText.length > 2000 ? `${rawText.slice(0, 2000)}…` : rawText,
    },
  };
}
