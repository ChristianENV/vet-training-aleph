import { SessionStatus, SessionType } from "@/generated/prisma/enums";

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  [SessionStatus.DRAFT]: "Draft",
  [SessionStatus.GENERATING_QUESTIONS]: "Generating questions",
  [SessionStatus.ACTIVE]: "In progress",
  [SessionStatus.SAVING_FINAL_RESPONSES]: "Saving your responses",
  [SessionStatus.ANALYZING]: "Analyzing your answers",
  [SessionStatus.PAUSED]: "Paused",
  [SessionStatus.COMPLETED]: "Completed",
  [SessionStatus.CANCELLED]: "Cancelled",
  [SessionStatus.ARCHIVED]: "Archived",
};

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  [SessionType.GUIDED_DIALOGUE]: "Guided dialogue",
  [SessionType.ROLE_PLAY]: "Role-play",
  [SessionType.VOCABULARY_DRILL]: "Vocabulary drill",
  [SessionType.CASE_REVIEW]: "Case review",
};
