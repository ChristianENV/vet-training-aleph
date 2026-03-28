import { z } from "zod";

const generatedQuestionItemSchema = z.object({
  ordinal: z.number().int().min(1).max(25),
  promptText: z.string().min(20).max(12_000),
  helpText: z.string().max(4000).optional().nullable(),
  expectedDurationSec: z.number().int().min(15).max(600).optional().nullable(),
  suggestedDurationSec: z.number().int().min(15).max(600).optional().nullable(),
  maxDurationSec: z.number().int().min(15).max(900).optional().nullable(),
});

export type GeneratedQuestionItem = z.infer<typeof generatedQuestionItemSchema>;

/**
 * Validates GPT output length and ordinals 1..n. Bounds come from server env (dev vs production).
 */
export function buildGeneratedQuestionsOutputSchema(questionCountMin: number, questionCountMax: number) {
  if (
    questionCountMin < 1 ||
    questionCountMax < questionCountMin ||
    questionCountMax > 25
  ) {
    throw new Error(
      "Invalid session question count bounds (expect 1 ≤ min ≤ max ≤ 25)",
    );
  }

  return z
    .object({
      questions: z
        .array(generatedQuestionItemSchema)
        .min(questionCountMin)
        .max(questionCountMax),
    })
    .superRefine((data, ctx) => {
      const n = data.questions.length;
      const ordinals = data.questions.map((q) => q.ordinal);
      const sorted = [...new Set(ordinals)].sort((a, b) => a - b);
      if (sorted.length !== n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate ordinals in questions" });
        return;
      }
      for (let i = 0; i < n; i++) {
        if (sorted[i] !== i + 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ordinals must be exactly 1..n with no gaps",
          });
          return;
        }
      }
    });
}

export type GeneratedQuestionsOutput = {
  questions: GeneratedQuestionItem[];
};
