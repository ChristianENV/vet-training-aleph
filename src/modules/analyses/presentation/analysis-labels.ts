import { AnalysisStatus, ReadinessLevel } from "@/generated/prisma/enums";

export const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, string> = {
  [AnalysisStatus.PENDING]: "Pending",
  [AnalysisStatus.RUNNING]: "Running",
  [AnalysisStatus.COMPLETED]: "Completed",
  [AnalysisStatus.FAILED]: "Failed",
};

export const READINESS_LABEL: Record<ReadinessLevel, string> = {
  [ReadinessLevel.FOUNDATION]: "Foundation",
  [ReadinessLevel.DEVELOPING]: "Developing",
  [ReadinessLevel.PROFICIENT]: "Proficient",
  [ReadinessLevel.WORK_READY]: "Work ready",
};

/** Map stored enum string to label when reading snapshots / loose JSON. */
export function readinessLabelFromString(value: string): string {
  const v = value as ReadinessLevel;
  return v in READINESS_LABEL ? READINESS_LABEL[v] : value;
}
