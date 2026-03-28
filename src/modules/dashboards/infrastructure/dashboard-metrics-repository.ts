import { Prisma } from "@/generated/prisma/client";
import { AnalysisStatus, ReadinessLevel, SessionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { defaultUserListFilter } from "@/lib/auth/permissions";

/** Non-protected accounts only — matches admin directory visibility. */
export async function countVisibleUsers() {
  return prisma.user.count({ where: defaultUserListFilter() });
}

export async function countVisibleUsersByActive() {
  const [active, inactive] = await Promise.all([
    prisma.user.count({ where: { ...defaultUserListFilter(), isActive: true } }),
    prisma.user.count({ where: { ...defaultUserListFilter(), isActive: false } }),
  ]);
  return { active, inactive, total: active + inactive };
}

export async function countAllUsers() {
  return prisma.user.count();
}

export async function countProtectedAccounts() {
  return prisma.user.count({ where: { isProtectedAccount: true } });
}

/**
 * Distinct user IDs with ≥1 completed session — **any** account (includes protected).
 * Use for platform-wide diagnostics only; prefer `countVisibleUsersWithAtLeastOneCompletedSession` for directory-aligned adoption.
 */
export async function countAllUsersWithAtLeastOneCompletedSession() {
  const rows = await prisma.trainingSession.groupBy({
    by: ["userId"],
    where: { status: SessionStatus.COMPLETED },
    _count: { _all: true },
  });
  return rows.length;
}

/** Distinct non-protected users with ≥1 completed session — matches directory / `defaultUserListFilter`. */
export async function countVisibleUsersWithAtLeastOneCompletedSession() {
  const rows = await prisma.trainingSession.groupBy({
    by: ["userId"],
    where: {
      status: SessionStatus.COMPLETED,
      user: defaultUserListFilter(),
    },
    _count: { _all: true },
  });
  return rows.length;
}

export async function countSessionsSince(since: Date) {
  return prisma.trainingSession.count({
    where: { createdAt: { gte: since } },
  });
}

export async function countSessionsTotal() {
  return prisma.trainingSession.count();
}

export async function groupSessionCountsByStatus() {
  const rows = await prisma.trainingSession.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const map = Object.values(SessionStatus).reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<SessionStatus, number>,
  );
  for (const r of rows) {
    map[r.status] = r._count._all;
  }
  return map;
}

export async function groupAnalysisCountsByStatus() {
  const rows = await prisma.sessionAnalysis.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const map = Object.values(AnalysisStatus).reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<AnalysisStatus, number>,
  );
  for (const r of rows) {
    map[r.status] = r._count._all;
  }
  return map;
}

export async function countAnalysesTotal() {
  return prisma.sessionAnalysis.count();
}

/**
 * Latest snapshot per learner (DISTINCT ON), for readiness distribution.
 */
export async function getLatestReadinessDistributionForVisibleUsers() {
  const rows = await prisma.$queryRaw<Array<{ readiness: string }>>(
    Prisma.sql`
      SELECT DISTINCT ON (ps."userId") ps.readiness::text AS readiness
      FROM "ProgressSnapshot" ps
      INNER JOIN "User" u ON u.id = ps."userId"
      WHERE u."isProtectedAccount" = false
      ORDER BY ps."userId", ps."capturedAt" DESC
    `,
  );

  const distribution = Object.values(ReadinessLevel).reduce(
    (acc, level) => {
      acc[level] = 0;
      return acc;
    },
    {} as Record<ReadinessLevel, number>,
  );

  for (const row of rows) {
    const level = row.readiness as ReadinessLevel;
    if (level in distribution) {
      distribution[level] += 1;
    }
  }

  return { distribution, learnersWithSnapshot: rows.length };
}

export async function listRecentSessionsForStaffDashboard(take: number) {
  return prisma.trainingSession.findMany({
    where: { user: defaultUserListFilter() },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      user: { select: { email: true } },
    },
  });
}
