import type { Prisma } from "@/generated/prisma/client";
import { ReadinessLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export async function findLatestProgressSnapshotForUser(userId: string) {
  return prisma.progressSnapshot.findFirst({
    where: { userId },
    orderBy: { capturedAt: "desc" },
  });
}

export async function createProgressSnapshot(input: {
  userId: string;
  readiness: ReadinessLevel;
  sessionId: string | null;
  metricsJson: Prisma.InputJsonValue;
}) {
  return prisma.progressSnapshot.create({
    data: {
      userId: input.userId,
      readiness: input.readiness,
      sessionId: input.sessionId,
      metricsJson: input.metricsJson,
    },
  });
}
