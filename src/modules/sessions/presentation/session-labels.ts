import { SessionStatus, SessionType } from "@/generated/prisma/enums";

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  [SessionStatus.DRAFT]: "Draft",
  [SessionStatus.GENERATING_QUESTIONS]: "Generating questions",
  [SessionStatus.ACTIVE]: "In progress",
  [SessionStatus.SAVING_FINAL_RESPONSES]: "Saving your responses",
  [SessionStatus.TRANSCRIBING]: "Preparing your answers",
  [SessionStatus.TRANSCRIPTION_FAILED]: "Couldn’t prepare answers yet",
  [SessionStatus.ANALYZING]: "Analyzing your answers",
  [SessionStatus.PAUSED]: "Paused",
  [SessionStatus.COMPLETED]: "Completed",
  [SessionStatus.CANCELLED]: "Cancelled",
  [SessionStatus.ARCHIVED]: "Archived",
};

/** Safe label for API/runtime strings (avoids raw enum text in the UI). */
export function getSessionStatusLabel(status: string): string {
  if (Object.prototype.hasOwnProperty.call(SESSION_STATUS_LABEL, status)) {
    return SESSION_STATUS_LABEL[status as SessionStatus];
  }
  if (looksLikeSessionEnum(status)) {
    return status
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
  }
  return status;
}

function looksLikeSessionEnum(s: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(s) && s.includes("_");
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  [SessionType.GUIDED_DIALOGUE]: "Guided dialogue",
  [SessionType.ROLE_PLAY]: "Role-play",
  [SessionType.VOCABULARY_DRILL]: "Vocabulary drill",
  [SessionType.CASE_REVIEW]: "Case review",
};
