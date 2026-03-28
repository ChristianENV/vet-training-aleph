import { z } from "zod";

export const generatedQuestionItemSchema = z.object({
  ordinal: z.number().int().min(1).max(10),
  promptText: z.string().min(20).max(12_000),
  helpText: z.string().max(4000).optional().nullable(),
  expectedDurationSec: z.number().int().min(15).max(600).optional().nullable(),
  suggestedDurationSec: z.number().int().min(15).max(600).optional().nullable(),
  maxDurationSec: z.number().int().min(15).max(900).optional().nullable(),
});

export const generatedQuestionsOutputSchema = z
  .object({
    questions: z.array(generatedQuestionItemSchema).min(5).max(10),
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

export type GeneratedQuestionsOutput = z.infer<typeof generatedQuestionsOutputSchema>;
