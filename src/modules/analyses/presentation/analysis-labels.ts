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

/** Enriched oral-assessment readiness (payload JSON), distinct from Prisma progress enum. */
export const ORAL_READINESS_LABEL: Record<string, string> = {
  not_ready: "Not ready yet",
  developing: "Developing",
  functional: "Functional",
  near_ready: "Almost ready",
  ready: "Ready",
};

export const CONFIDENCE_LEVEL_LABEL: Record<string, string> = {
  low: "Lower confidence",
  medium: "Moderate confidence",
  high: "Higher confidence",
};

export const EVIDENCE_BASIS_LABEL: Record<string, string> = {
  transcript_only: "Based mainly on what was said (transcript)",
  transcript_plus_timing_metadata: "Transcript plus simple timing info",
  audio_derived_features: "Includes audio-derived signals",
};
