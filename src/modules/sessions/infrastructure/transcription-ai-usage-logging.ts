import type { Prisma } from "@/generated/prisma/client";
import { AiOperationType, AiUsageLogStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * One final-audio transcription call. Token/cost fields stay null when the API does not return them.
 */
export async function recordTranscriptionAiUsage(input: {
  userId: string;
  sessionId: string;
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
      operationType: AiOperationType.TRANSCRIBE_AUDIO,
      userId: input.userId,
      sessionId: input.sessionId,
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
