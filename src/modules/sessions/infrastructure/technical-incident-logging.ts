import type { Prisma } from "@/generated/prisma/client";
import { IncidentSeverity } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export async function recordSessionFinalizeIncident(input: {
  userId: string;
  sessionId: string;
  sessionQuestionId?: string | null;
  stage: string;
  provider?: string | null;
  errorCode?: string | null;
  errorMessage: string;
  detailsJson?: Record<string, unknown>;
  severity?: IncidentSeverity;
}) {
  await prisma.technicalIncident.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId,
      sessionQuestionId: input.sessionQuestionId ?? undefined,
      stage: input.stage,
      provider: input.provider ?? undefined,
      errorCode: input.errorCode ?? undefined,
      errorMessage: input.errorMessage,
      detailsJson: (input.detailsJson ?? undefined) as Prisma.InputJsonValue | undefined,
      severity: input.severity ?? IncidentSeverity.MEDIUM,
    },
  });
}
