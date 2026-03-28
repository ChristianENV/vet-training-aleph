import type { Prisma } from "@/generated/prisma/client";
import {
  AiOperationType,
  AiUsageLogStatus,
  IncidentSeverity,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/** GENERATE_QUESTIONS usage; failed runs must leave `estimatedCostUsd` null to avoid misleading costs. */
export async function recordQuestionGenerationAiUsage(input: {
  userId: string;
  sessionId: string;
  model: string;
  status: AiUsageLogStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  requestMetaJson: Prisma.InputJsonValue;
  responseMetaJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.aiUsageLog.create({
    data: {
      operationType: AiOperationType.GENERATE_QUESTIONS,
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
      responseMetaJson: input.responseMetaJson ?? undefined,
    },
  });
}

export async function recordQuestionGenerationIncident(input: {
  userId: string;
  sessionId: string;
  errorMessage: string;
  detailsJson?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.technicalIncident.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId,
      stage: "question_generation",
      provider: "openai",
      errorMessage: input.errorMessage.slice(0, 8000),
      detailsJson: input.detailsJson,
      severity: IncidentSeverity.HIGH,
    },
  });
}
