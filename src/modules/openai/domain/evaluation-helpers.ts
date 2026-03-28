import { ReadinessLevel } from "@/generated/prisma/enums";
import type { OralReadinessLevel, SessionEvaluationOutput } from "@/modules/openai/schemas/session-evaluation-output";

const READINESS_SCORE_FALLBACK: Record<OralReadinessLevel, number> = {
  not_ready: 32,
  developing: 52,
  functional: 68,
  near_ready: 82,
  ready: 92,
};

/** Single number for dashboards when pillar scores are partly null. */
export function deriveOverallScore(evaluation: SessionEvaluationOutput): number {
  const scores = [
    evaluation.scoring.speaking.score,
    evaluation.scoring.languageControl.score,
    evaluation.scoring.veterinaryCommunication.score,
  ].filter((n): n is number => n != null);
  if (scores.length > 0) {
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return READINESS_SCORE_FALLBACK[evaluation.readinessLevel];
}

/** Maps model readiness to Prisma enum for ProgressSnapshot (4 buckets). */
export function mapEnrichedReadinessToPrisma(level: OralReadinessLevel): ReadinessLevel {
  const map: Record<OralReadinessLevel, ReadinessLevel> = {
    not_ready: ReadinessLevel.FOUNDATION,
    developing: ReadinessLevel.DEVELOPING,
    functional: ReadinessLevel.PROFICIENT,
    near_ready: ReadinessLevel.PROFICIENT,
    ready: ReadinessLevel.WORK_READY,
  };
  return map[level];
}
