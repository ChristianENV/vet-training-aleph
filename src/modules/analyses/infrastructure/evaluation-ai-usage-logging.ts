import type { Prisma } from "@/generated/prisma/client";
import { AiOperationType, AiUsageLogStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * Persists one EVALUATE_SESSION call. For future TRANSCRIBE_AUDIO rows, use the same shape:
 * `operationType: TRANSCRIBE_AUDIO`, `analysisId` optional, token fields when the provider returns them,
 * `estimatedCostUsd` only when both prompt and completion tokens are known (see `estimateOpenAiMiniCostUsdFromUsage`).
 */
export async function recordSessionEvaluationAiUsage(input: {
  userId: string;
  sessionId: string;
  analysisId: string | null;
  model: string;
  status: AiUsageLogStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  requestMetaJson?: Prisma.InputJsonValue;
  responseMetaJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.aiUsageLog.create({
    data: {
      operationType: AiOperationType.EVALUATE_SESSION,
      userId: input.userId,
      sessionId: input.sessionId,
      analysisId: input.analysisId ?? undefined,
      provider: "openai",
      model: input.model,
      promptTokens: input.promptTokens ?? undefined,
      completionTokens: input.completionTokens ?? undefined,
      totalTokens: input.totalTokens ?? undefined,
      estimatedCostUsd: input.estimatedCostUsd ?? undefined,
      status: input.status,
      requestMetaJson: input.requestMetaJson,
      responseMetaJson: input.responseMetaJson,
    },
  });
}
