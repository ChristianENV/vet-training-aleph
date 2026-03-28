import { prisma } from "@/lib/db/prisma";

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
    },
  });
}
