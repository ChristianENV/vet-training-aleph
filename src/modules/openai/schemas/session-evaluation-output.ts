import { z } from "zod";
import { ReadinessLevel } from "@/generated/prisma/enums";

/**
 * Structured output from the session evaluation model.
 * Must stay in sync with `payloadJson.evaluation` in SessionAnalysis.
 */
export const sessionEvaluationOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  fluencyScore: z.number().min(0).max(100),
  technicalAccuracyScore: z.number().min(0).max(100),
  clientCommunicationScore: z.number().min(0).max(100),
  professionalismScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  readinessLevel: z.enum([
    ReadinessLevel.FOUNDATION,
    ReadinessLevel.DEVELOPING,
    ReadinessLevel.PROFICIENT,
    ReadinessLevel.WORK_READY,
  ]),
  strengths: z.array(z.string().min(1)).min(1).max(12),
  weaknesses: z.array(z.string().min(1)).min(1).max(12),
  recommendations: z.array(z.string().min(1)).min(1).max(12),
  /** Short summary for SessionAnalysis.summary and UI */
  summary: z.string().min(1).max(2000),
});

export type SessionEvaluationOutput = z.infer<typeof sessionEvaluationOutputSchema>;
