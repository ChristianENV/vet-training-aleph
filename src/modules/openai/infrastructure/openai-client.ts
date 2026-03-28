import OpenAI from "openai";
import { getServerEnv } from "@/lib/config/env";

export function createOpenAIClient(): OpenAI {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export function getEvalModelName(): string {
  return getServerEnv().OPENAI_EVAL_MODEL;
}

/** Model for GPT session question generation; falls back to eval model. */
export function getQuestionsModelName(): string {
  const env = getServerEnv();
  return env.OPENAI_QUESTIONS_MODEL ?? env.OPENAI_EVAL_MODEL;
}
