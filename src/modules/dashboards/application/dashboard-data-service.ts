import {
  findLatestAnalysisBySessionIds,
  listAnalysesForUser,
} from "@/modules/analyses/infrastructure/session-analysis-repository";
import { findLatestProgressSnapshotForUser } from "@/modules/analyses/infrastructure/progress-repository";
import {
  listSessionsForUser,
  sessionListSelect,
} from "@/modules/sessions/infrastructure/session-repository";
import {
  countAllUsers,
  countAnalysesTotal,
  countProtectedAccounts,
  countSessionsSince,
  countSessionsTotal,
  countUsersWithAtLeastOneCompletedSession,
  countVisibleUsersByActive,
  getLatestReadinessDistributionForVisibleUsers,
  groupAnalysisCountsByStatus,
  groupSessionCountsByStatus,
  listRecentSessionsForStaffDashboard,
} from "@/modules/dashboards/infrastructure/dashboard-metrics-repository";
import { AnalysisStatus, ReadinessLevel, SessionStatus, UserRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type UserNextAction =
  | { kind: "start_first_session"; href: "/sessions" }
  | { kind: "continue_session"; sessionId: string; href: string; headline: string }
  | { kind: "evaluation_pending"; sessionId: string; href: string }
  | { kind: "run_evaluation"; sessionId: string; href: string }
  | { kind: "review_analysis"; analysisId: string; href: string }
  | { kind: "review_analyses"; href: "/analyses" };

type SessionListRow = Prisma.TrainingSessionGetPayload<{ select: typeof sessionListSelect }>;

function computeUserNextAction(
  sessions: Pick<SessionListRow, "id" | "status" | "updatedAt">[],
  latestBySessionId: Map<string, { id: string; status: AnalysisStatus }>,
  latestAnalysisForUser: { id: string } | null,
): UserNextAction {
  if (sessions.length === 0) {
    return { kind: "start_first_session", href: "/sessions" };
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  for (const s of sorted) {
    if (
      s.status === SessionStatus.DRAFT ||
      s.status === SessionStatus.ACTIVE ||
      s.status === SessionStatus.PAUSED
    ) {
      const headline =
        s.status === SessionStatus.DRAFT
          ? "Continue your draft session"
          : s.status === SessionStatus.PAUSED
            ? "Resume your paused session"
            : s.status === SessionStatus.ACTIVE
              ? "Continue or complete your session"
              : "Continue your session";
      return {
        kind: "continue_session",
        sessionId: s.id,
        href: `/sessions/${s.id}`,
        headline,
      };
    }
  }

  for (const s of sorted) {
    if (s.status !== SessionStatus.COMPLETED) continue;
    const latest = latestBySessionId.get(s.id);
    if (!latest) {
      return { kind: "run_evaluation", sessionId: s.id, href: `/sessions/${s.id}` };
    }
    if (latest.status === AnalysisStatus.PENDING || latest.status === AnalysisStatus.RUNNING) {
      return { kind: "evaluation_pending", sessionId: s.id, href: `/sessions/${s.id}` };
    }
    if (latest.status === AnalysisStatus.FAILED) {
      return { kind: "run_evaluation", sessionId: s.id, href: `/sessions/${s.id}` };
    }
  }

  if (latestAnalysisForUser) {
    return {
      kind: "review_analysis",
      analysisId: latestAnalysisForUser.id,
      href: `/analyses/${latestAnalysisForUser.id}`,
    };
  }

  return { kind: "review_analyses", href: "/analyses" };
}

export type UserDashboardData = {
  recentSessions: SessionListRow[];
  latestAnalysis: Awaited<ReturnType<typeof listAnalysesForUser>>[number] | null;
  latestProgress: Awaited<ReturnType<typeof findLatestProgressSnapshotForUser>>;
  nextAction: UserNextAction;
};

export async function getUserDashboardData(userId: string): Promise<UserDashboardData> {
  const [recentSessions, latestAnalysisList, latestProgress] = await Promise.all([
    listSessionsForUser({ userId, take: 8 }),
    listAnalysesForUser({ userId, take: 1 }),
    findLatestProgressSnapshotForUser(userId),
  ]);

  const forAction = await listSessionsForUser({ userId, take: 40 });
  const sessionIds = forAction.map((s) => s.id);
  const latestBySessionId = await findLatestAnalysisBySessionIds(sessionIds);
  const latestAnalysis = latestAnalysisList[0] ?? null;

  const nextAction = computeUserNextAction(
    forAction,
    latestBySessionId,
    latestAnalysis ? { id: latestAnalysis.id } : null,
  );

  return {
    recentSessions,
    latestAnalysis,
    latestProgress,
    nextAction,
  };
}

export type StaffDashboardVariant = "admin" | "product_owner" | "super_admin" | "developer";

export type StaffDashboardData = {
  variant: StaffDashboardVariant;
  users: {
    visibleTotal: number;
    active: number;
    inactive: number;
    /** SUPER_ADMIN / DEVELOPER only — includes protected accounts. */
    allAccountsTotal?: number;
    /** SUPER_ADMIN / DEVELOPER — aggregate count only. */
    protectedAccounts?: number;
  };
  learnersWithCompletedSession: number;
  sessions: {
    total: number;
    createdLast7Days: number;
    byStatus: Record<SessionStatus, number>;
  };
  analyses: {
    total: number;
    byStatus: Record<AnalysisStatus, number>;
  };
  readiness: {
    distribution: Record<ReadinessLevel, number>;
    learnersWithSnapshot: number;
  };
  recentSessions: Awaited<ReturnType<typeof listRecentSessionsForStaffDashboard>>;
};

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function getStaffDashboardData(variant: StaffDashboardVariant): Promise<StaffDashboardData> {
  const since7 = daysAgo(7);

  const [
    visibleCounts,
    sessionsTotal,
    sessions7d,
    sessionsByStatus,
    analysesByStatus,
    analysesTotal,
    readiness,
    recentSessions,
    learnersCompleted,
  ] = await Promise.all([
    countVisibleUsersByActive(),
    countSessionsTotal(),
    countSessionsSince(since7),
    groupSessionCountsByStatus(),
    groupAnalysisCountsByStatus(),
    countAnalysesTotal(),
    getLatestReadinessDistributionForVisibleUsers(),
    listRecentSessionsForStaffDashboard(12),
    countUsersWithAtLeastOneCompletedSession(),
  ]);

  const base: StaffDashboardData = {
    variant,
    users: {
      visibleTotal: visibleCounts.total,
      active: visibleCounts.active,
      inactive: visibleCounts.inactive,
    },
    learnersWithCompletedSession: learnersCompleted,
    sessions: {
      total: sessionsTotal,
      createdLast7Days: sessions7d,
      byStatus: sessionsByStatus,
    },
    analyses: {
      total: analysesTotal,
      byStatus: analysesByStatus,
    },
    readiness,
    recentSessions,
  };

  if (variant === "super_admin" || variant === "developer") {
    const [allAccountsTotal, protectedAccounts] = await Promise.all([
      countAllUsers(),
      countProtectedAccounts(),
    ]);
    base.users.allAccountsTotal = allAccountsTotal;
    base.users.protectedAccounts = protectedAccounts;
  }

  return base;
}

export function staffVariantForRole(role: UserRole): StaffDashboardVariant | null {
  switch (role) {
    case UserRole.ADMIN:
      return "admin";
    case UserRole.PRODUCT_OWNER:
      return "product_owner";
    case UserRole.SUPER_ADMIN:
      return "super_admin";
    case UserRole.DEVELOPER:
      return "developer";
    default:
      return null;
  }
}
