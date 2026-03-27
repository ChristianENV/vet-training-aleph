import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { AnalysisStatus } from "@/generated/prisma/enums";
import * as analysisRepo from "@/modules/analyses/infrastructure/session-analysis-repository";
import * as progressRepo from "@/modules/analyses/infrastructure/progress-repository";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";

export function canViewAnalysisRecord(
  actor: AuthenticatedUser,
  session: { userId: string },
): boolean {
  if (session.userId === actor.id) {
    return roleHasPermission(actor.role, "analyses:view");
  }
  return (
    roleHasPermission(actor.role, "sessions:view_any") &&
    roleHasPermission(actor.role, "analyses:view")
  );
}

export async function listAnalysesForActor(
  actor: AuthenticatedUser,
  query: { take: number; status?: AnalysisStatus; userId?: string },
) {
  const viewAny = roleHasPermission(actor.role, "sessions:view_any");

  if (!viewAny) {
    return analysisRepo.listAnalysesForUser({
      userId: actor.id,
      take: query.take,
      status: query.status,
    });
  }

  return analysisRepo.listAnalysesForPrivileged({
    take: query.take,
    status: query.status,
    filterUserId: query.userId,
  });
}

export async function getAnalysisDetailForActor(actor: AuthenticatedUser, analysisId: string) {
  const row = await analysisRepo.findAnalysisByIdWithSession(analysisId);
  if (!row) {
    throw new AnalysisServiceError(404, "Analysis not found", "NOT_FOUND");
  }
  if (!canViewAnalysisRecord(actor, row.session)) {
    throw new AnalysisServiceError(403, "You cannot access this analysis", "FORBIDDEN");
  }
  return row;
}

export async function getProgressSummaryForActor(
  actor: AuthenticatedUser,
  query: { userId?: string },
) {
  if (!roleHasPermission(actor.role, "analyses:view")) {
    throw new AnalysisServiceError(403, "Missing permission: analyses:view", "FORBIDDEN");
  }

  const viewAny = roleHasPermission(actor.role, "sessions:view_any");

  if (!viewAny && query.userId && query.userId !== actor.id) {
    throw new AnalysisServiceError(403, "Cannot load progress for another user", "FORBIDDEN");
  }

  const targetUserId = viewAny && query.userId ? query.userId : actor.id;

  return progressRepo.findLatestProgressSnapshotForUser(targetUserId);
}
