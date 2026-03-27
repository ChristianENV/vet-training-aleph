import type { SessionStatus, SessionType } from "@/generated/prisma/enums";
import { parseApiJsonResponse } from "@/lib/http/api-client";
import type { SessionListQuery } from "@/modules/sessions/validators/sessions";

export type TemplateQuestionRow = {
  id: string;
  ordinal: number;
  promptText: string;
  helpText: string | null;
  expectedDurationSec: number | null;
  isRequired: boolean;
};

export type SessionResponseRow = {
  id: string;
  templateQuestionId: string;
  ordinal: number;
  audioUrl: string | null;
  transcriptText: string | null;
  durationSec: number | null;
  answeredAt: string;
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
  _count?: { questions: number };
  questions?: TemplateQuestionRow[];
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
  template: {
    id: string;
    slug: string;
    title: string;
    sessionType: SessionType;
    description?: string | null;
    questions?: TemplateQuestionRow[];
  } | null;
  responses?: SessionResponseRow[];
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
  templateQuestionId: string;
  transcriptText?: string;
  audioUrl?: string;
  durationSec?: number;
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

export async function cancelSessionRequest(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<{ session: TrainingSessionRow; progress: SessionProgressDto }>(res);
}
