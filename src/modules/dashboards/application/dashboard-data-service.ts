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
  countAllUsersWithAtLeastOneCompletedSession,
  countAnalysesTotal,
  countProtectedAccounts,
  countSessionsSince,
  countSessionsTotal,
  countVisibleUsersByActive,
  countVisibleUsersWithAtLeastOneCompletedSession,
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
  /** User directory: non-protected accounts only (same filter as Users admin list). */
  users: {
    visibleTotal: number;
    active: number;
    inactive: number;
    /** SUPER_ADMIN / DEVELOPER only — includes protected accounts. */
    allAccountsTotal?: number;
    /** SUPER_ADMIN / DEVELOPER — aggregate count only. */
    protectedAccounts?: number;
  };
  /** Non-protected learners with ≥1 completed session (directory scope). */
  learnersWithCompletedSessionVisible: number;
  /** SUPER_ADMIN / DEVELOPER — distinct users with ≥1 completed session including protected-account owners. */
  learnersWithCompletedSessionAllAccounts?: number;
  /** All training sessions in the database (every account). */
  sessions: {
    total: number;
    createdLast7Days: number;
    byStatus: Record<SessionStatus, number>;
  };
  /** All SessionAnalysis rows (every account). */
  analyses: {
    total: number;
    byStatus: Record<AnalysisStatus, number>;
  };
  /** Latest snapshot per non-protected user only. */
  readiness: {
    distribution: Record<ReadinessLevel, number>;
    learnersWithSnapshot: number;
  };
  /** Sessions owned by non-protected users only. */
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
    learnersCompletedVisible,
  ] = await Promise.all([
    countVisibleUsersByActive(),
    countSessionsTotal(),
    countSessionsSince(since7),
    groupSessionCountsByStatus(),
    groupAnalysisCountsByStatus(),
    countAnalysesTotal(),
    getLatestReadinessDistributionForVisibleUsers(),
    listRecentSessionsForStaffDashboard(12),
    countVisibleUsersWithAtLeastOneCompletedSession(),
  ]);

  const base: StaffDashboardData = {
    variant,
    users: {
      visibleTotal: visibleCounts.total,
      active: visibleCounts.active,
      inactive: visibleCounts.inactive,
    },
    learnersWithCompletedSessionVisible: learnersCompletedVisible,
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
    const [allAccountsTotal, protectedAccounts, learnersCompletedAll] = await Promise.all([
      countAllUsers(),
      countProtectedAccounts(),
      countAllUsersWithAtLeastOneCompletedSession(),
    ]);
    base.users.allAccountsTotal = allAccountsTotal;
    base.users.protectedAccounts = protectedAccounts;
    base.learnersWithCompletedSessionAllAccounts = learnersCompletedAll;
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
