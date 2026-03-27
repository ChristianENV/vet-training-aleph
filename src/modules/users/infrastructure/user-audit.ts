import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function writeUserAuditLog(input: {
  actorUserId: string;
  subjectUserId?: string;
  action: string;
  resourceType: "User";
  resourceId?: string;
  metadataJson?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      subjectUserId: input.subjectUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined,
    },
  });
}
