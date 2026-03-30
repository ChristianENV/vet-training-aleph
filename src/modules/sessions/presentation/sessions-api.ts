import type { SessionStatus, SessionType } from "@/generated/prisma/enums";
import { parseApiJsonResponse } from "@/lib/http/api-client";
import type { SessionListQuery } from "@/modules/sessions/validators/sessions";

export type SessionQuestionRow = {
  id: string;
  ordinal: number;
  promptText: string;
  helpText: string | null;
  expectedDurationSec: number | null;
  suggestedDurationSec: number | null;
  maxDurationSec: number | null;
  isRequired: boolean;
  generatedByModel: string | null;
  sourceTopic: string | null;
};

export type SessionResponseRow = {
  id: string;
  sessionQuestionId: string;
  ordinal: number;
  transcriptText: string | null;
  transcriptStatus: string | null;
  transcriptProvider: string | null;
  finalAudioStorageKey: string | null;
  /** `r2` when the file was stored in Cloudflare R2; `dev-placeholder` when R2 was not configured. */
  finalAudioProvider: string | null;
  finalAudioDurationSec: number | null;
  finalAudioMimeType: string | null;
  finalAudioBytes: number | null;
  attemptCount: number;
  maxAttempts: number;
  answeredAt: string | null;
};

export type SessionProgressDto = {
  totalQuestions: number;
  answeredCount: number;
  currentQuestionId: string | null;
  completionPercent: number;
};

export type SessionTemplateRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sessionType: SessionType;
  sortOrder: number;
  createdAt: string;
};

export type TrainingSessionRow = {
  id: string;
  userId: string;
  templateId: string | null;
  status: SessionStatus;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Server-only finalize metadata (e.g. transcript fallback ordinals). */
  finalizationMetaJson?: unknown;
  template: {
    id: string;
    slug: string;
    title: string;
    sessionType: SessionType;
    description?: string | null;
  } | null;
  sessionQuestions?: SessionQuestionRow[];
  responses?: SessionResponseRow[];
};

/** Subset returned from POST `/api/sessions/:id/finalize` for navigation and status. */
export type FinalizeSessionEvaluationDto = {
  analysis: {
    id: string;
    status: string;
    summary: string | null;
    errorMessage: string | null;
  };
  evaluationRun: { outcome: "SUCCEEDED" | "FAILED"; message: string | null };
};

export async function fetchTemplates() {
  const res = await fetch("/api/sessions/templates", { credentials: "include" });
  return parseApiJsonResponse<{ templates: SessionTemplateRow[] }>(res);
}

export async function fetchSessionsList(query: SessionListQuery) {
  const params = new URLSearchParams();
  params.set("take", String(query.take));
  if (query.status) params.set("status", query.status);
  if (query.userId) params.set("userId", query.userId);
  const res = await fetch(`/api/sessions?${params.toString()}`, { credentials: "include" });
  return parseApiJsonResponse<{ sessions: TrainingSessionRow[] }>(res);
}

export async function createSessionRequest(templateId: string) {
  const res = await fetch("/api/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}

export async function fetchSessionDetail(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}`, { credentials: "include" });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}

export async function startSessionRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/start`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}

export type SubmitSessionResponseBody = {
  sessionQuestionId: string;
  transcriptText?: string;
  finalAudioStorageKey?: string;
  finalAudioDurationSec?: number;
  finalAudioMimeType?: string;
  finalAudioBytes?: number;
};

export async function submitSessionResponseRequest(
  sessionId: string,
  body: SubmitSessionResponseBody,
) {
  const res = await fetch(`/api/sessions/${sessionId}/responses`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}

export async function completeSessionRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}

export async function finalizeSessionRequest(sessionId: string, formData: FormData) {
  const res = await fetch(`/api/sessions/${sessionId}/finalize`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return parseApiJsonResponse<{
    session: TrainingSessionRow;
    progress: SessionProgressDto;
    evaluation: FinalizeSessionEvaluationDto | null;
    transcriptionFailed: boolean;
    transcriptionFailureMessage?: string | null;
  }>(res);
}

export async function resumePostFinalizeRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/resume-post-finalize`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<{
    session: TrainingSessionRow;
    progress: SessionProgressDto;
    evaluation: FinalizeSessionEvaluationDto | null;
    transcriptionFailed: boolean;
    transcriptionFailureMessage?: string | null;
  }>(res);
}

export async function cancelSessionRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}
