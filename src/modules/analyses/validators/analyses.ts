import { z } from "zod";
import { AnalysisStatus } from "@/generated/prisma/enums";

/** POST .../analysis/evaluate — no body required for MVP */
export const triggerSessionEvaluationBodySchema = z.object({}).strict();

export const analysisListQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional().default(40),
  status: z.nativeEnum(AnalysisStatus).optional(),
  /** Only with `sessions:view_any`: filter by session owner */
  userId: z.string().cuid().optional(),
});

export type AnalysisListQuery = z.infer<typeof analysisListQuerySchema>;

export const progressSummaryQuerySchema = z.object({
  userId: z.string().cuid().optional(),
});

export type ProgressSummaryQuery = z.infer<typeof progressSummaryQuerySchema>;
