import { prisma } from "@/lib/db/prisma";
import { templateQuestionPublicSelect } from "@/modules/sessions/infrastructure/session-repository";

export async function listPublishedTemplates() {
  return prisma.sessionTemplate.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      sessionType: true,
      sortOrder: true,
      createdAt: true,
      _count: {
        select: { questions: true },
      },
      questions: {
        orderBy: { ordinal: "asc" },
        select: templateQuestionPublicSelect,
      },
    },
  });
}

export async function getPublishedTemplateById(id: string) {
  return prisma.sessionTemplate.findFirst({
    where: { id, published: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      sessionType: true,
      configJson: true,
      sortOrder: true,
      questions: {
        orderBy: { ordinal: "asc" },
        select: templateQuestionPublicSelect,
      },
    },
  });
}
