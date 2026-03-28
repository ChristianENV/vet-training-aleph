import type { AnalysisStatus } from "@/generated/prisma/enums";
import { parseApiJsonResponse } from "@/lib/http/api-client";

export type SessionAnalysisDto = {
  id: string;
  sessionId: string;
  status: AnalysisStatus;
  model: string | null;
  summary: string | null;
  payloadJson: unknown;
  schemaVersion: string | null;
  resultKind: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisListItemDto = {
  id: string;
  sessionId: string;
  status: AnalysisStatus;
  summary: string | null;
  completedAt: string | null;
  createdAt: string;
  session: {
    id: string;
    title: string | null;
    userId: string;
    template: { title: string; slug: string } | null;
  };
};

export type ProgressSnapshotDto = {
  id: string;
  userId: string;
  readiness: string;
  capturedAt: string;
  metricsJson: unknown;
  sessionId: string | null;
};

export async function fetchAnalysesList(params?: { take?: number; status?: AnalysisStatus }) {
  const sp = new URLSearchParams();
  if (params?.take) sp.set("take", String(params.take));
  if (params?.status) sp.set("status", params.status);
  const q = sp.toString();
  const res = await fetch(`/api/analyses${q ? `?${q}` : ""}`, { credentials: "include" });
  return parseApiJsonResponse<{ analyses: AnalysisListItemDto[] }>(res);
}

export async function fetchAnalysisDetail(analysisId: string) {
  const res = await fetch(`/api/analyses/${analysisId}`, { credentials: "include" });
  return parseApiJsonResponse<{ analysis: SessionAnalysisDto & { session: unknown } }>(res);
}

export async function fetchProgressSummary(userId?: string) {
  const sp = new URLSearchParams();
  if (userId) sp.set("userId", userId);
  const q = sp.toString();
  const res = await fetch(`/api/progress/summary${q ? `?${q}` : ""}`, { credentials: "include" });
  return parseApiJsonResponse<{ snapshot: ProgressSnapshotDto | null }>(res);
}

export async function fetchSessionAnalysis(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/analysis`, {
    credentials: "include",
  });
  return parseApiJsonResponse<{ analysis: SessionAnalysisDto | null }>(res);
}

/** Mirrors POST `/api/sessions/.../analysis/evaluate` — check `evaluationRun.outcome` for model success. */
export type SessionEvaluationRunDto = {
  outcome: "SUCCEEDED" | "FAILED";
  message: string | null;
};

export async function requestSessionEvaluation(sessionId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/analysis/evaluate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiJsonResponse<{
    analysis: SessionAnalysisDto;
    evaluationRun: SessionEvaluationRunDto;
  }>(res);
}
