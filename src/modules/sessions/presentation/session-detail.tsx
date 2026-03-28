"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SessionStatus } from "@/generated/prisma/enums";
import { QueryLoadingHint } from "@/components/shared/query-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useSessionUser } from "@/hooks/use-session-user";
import { roleHasPermission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { SessionAnalysisPanel } from "@/modules/analyses/presentation/session-analysis-panel";
import {
  cancelSessionRequest,
  completeSessionRequest,
  fetchSessionDetail,
  startSessionRequest,
  submitSessionResponseRequest,
  type SessionResponseRow,
  type TemplateQuestionRow,
  type TrainingSessionRow,
} from "./sessions-api";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL } from "./session-labels";

function responseHasContent(r: { transcriptText: string | null; audioUrl: string | null } | undefined) {
  if (!r) return false;
  return Boolean(r.transcriptText?.trim() || r.audioUrl?.trim());
}

/** Strict ordinal order: index of first question without transcript/audio, or -1 if all satisfied. */
function indexOfFirstUnsatisfied(
  questions: TemplateQuestionRow[],
  responseByQuestion: Map<string, SessionResponseRow>,
): number {
  const ordered = [...questions].sort((a, b) => a.ordinal - b.ordinal);
  for (let i = 0; i < ordered.length; i++) {
    const r = responseByQuestion.get(ordered[i].id);
    if (!responseHasContent(r)) return i;
  }
  return -1;
}

function canCompleteSession(session: TrainingSessionRow): boolean {
  const qs = session.template?.questions ?? [];
  const required = qs.filter((q) => q.isRequired);
  const byId = new Map((session.responses ?? []).map((r) => [r.templateQuestionId, r]));
  return required.every((q) => {
    const r = byId.get(q.id);
    return r && responseHasContent(r);
  });
}

type Props = {
  sessionId: string;
};

export function SessionDetail({ sessionId }: Props) {
  const queryClient = useQueryClient();
  const { data: auth } = useSessionUser();
  const [draft, setDraft] = useState({ transcript: "", durationSec: "", audioUrl: "" });
  /** Selected question in the answer panel (current or an earlier ordinal for edits). */
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["training-session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
  });

  const role = auth?.user?.role;
  const actorId = auth?.user?.id;
  const canUse = role ? roleHasPermission(role, "sessions:use") : false;
  const session = sessionQuery.data?.session;
  const progress = sessionQuery.data?.progress;
  const isOwner = !!(actorId && session && session.userId === actorId);
  const canMutate = canUse && isOwner;
  const canRequestAnalysis =
    !!isOwner &&
    !!role &&
    roleHasPermission(role, "analyses:request") &&
    session?.status === SessionStatus.COMPLETED;
  const canViewAnalysis = !!role && roleHasPermission(role, "analyses:view");

  const questions = session?.template?.questions ?? [];
  const questionsOrdered = useMemo(
    () => [...questions].sort((a, b) => a.ordinal - b.ordinal),
    [questions],
  );

  const responseByQuestion = useMemo(() => {
    return new Map((session?.responses ?? []).map((r) => [r.templateQuestionId, r]));
  }, [session?.responses]);

  const allQuestionsAnswered =
    !!progress &&
    progress.totalQuestions > 0 &&
    progress.answeredCount >= progress.totalQuestions;

  const firstUnsatisfiedIdx = useMemo(
    () => indexOfFirstUnsatisfied(questions, responseByQuestion),
    [questions, responseByQuestion],
  );

  /** Locked = future ordinal while there is still an unanswered step (strict flow). */
  const isQuestionLocked = useCallback(
    (q: TemplateQuestionRow) => {
      if (session?.status !== SessionStatus.ACTIVE) return false;
      if (firstUnsatisfiedIdx < 0) return false;
      const idx = questionsOrdered.findIndex((x) => x.id === q.id);
      return idx > firstUnsatisfiedIdx;
    },
    [firstUnsatisfiedIdx, questionsOrdered, session?.status],
  );

  const effectiveQuestionId = useMemo(() => {
    if (selectedQuestionId) {
      const sel = questionsOrdered.find((q) => q.id === selectedQuestionId);
      if (!sel) return progress?.currentQuestionId ?? questionsOrdered[0]?.id ?? null;
      if (session?.status !== SessionStatus.ACTIVE) return selectedQuestionId;
      if (firstUnsatisfiedIdx < 0) return selectedQuestionId;
      const selIdx = questionsOrdered.findIndex((q) => q.id === selectedQuestionId);
      if (selIdx >= 0 && selIdx <= firstUnsatisfiedIdx) return selectedQuestionId;
      return progress?.currentQuestionId ?? questionsOrdered[0]?.id ?? null;
    }
    return progress?.currentQuestionId ?? questionsOrdered[0]?.id ?? null;
  }, [
    firstUnsatisfiedIdx,
    progress?.currentQuestionId,
    questionsOrdered,
    session?.status,
    selectedQuestionId,
  ]);

  const currentQuestion = questionsOrdered.find((q) => q.id === effectiveQuestionId) ?? null;

  useEffect(() => {
    if (!effectiveQuestionId) return;
    const r = responseByQuestion.get(effectiveQuestionId);
    if (r) {
      setDraft({
        transcript: r.transcriptText ?? "",
        durationSec: r.durationSec != null ? String(r.durationSec) : "",
        audioUrl: r.audioUrl ?? "",
      });
    } else {
      setDraft({ transcript: "", durationSec: "", audioUrl: "" });
    }
  }, [effectiveQuestionId, responseByQuestion]);

  /** Clear selection if user advanced and had picked a now-locked question. */
  useEffect(() => {
    if (!selectedQuestionId || session?.status !== SessionStatus.ACTIVE) return;
    if (firstUnsatisfiedIdx < 0) return;
    const selIdx = questionsOrdered.findIndex((q) => q.id === selectedQuestionId);
    if (selIdx > firstUnsatisfiedIdx) {
      setSelectedQuestionId(null);
    }
  }, [firstUnsatisfiedIdx, questionsOrdered, session?.status, selectedQuestionId]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["training-session", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["analyses-list"] });
  }, [queryClient, sessionId]);

  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const flashBanner = useCallback((msg: string) => {
    setActionBanner(msg);
    window.setTimeout(() => setActionBanner(null), 3800);
  }, []);

  const startMut = useMutation({
    mutationFn: () => startSessionRequest(sessionId),
    onSuccess: () => {
      invalidate();
      flashBanner("Session started — answer each question in order before moving on.");
    },
  });

  const responseMut = useMutation({
    mutationFn: () => {
      if (!currentQuestion) throw new Error("No question selected");
      const durationRaw = draft.durationSec.trim();
      const durationParsed = durationRaw ? Number(durationRaw) : undefined;
      return submitSessionResponseRequest(sessionId, {
        templateQuestionId: currentQuestion.id, // effectiveQuestionId; server enforces order
        transcriptText: draft.transcript.trim() || undefined,
        audioUrl: draft.audioUrl.trim() || undefined,
        durationSec:
          durationParsed !== undefined && Number.isFinite(durationParsed) ? durationParsed : undefined,
      });
    },
    onSuccess: () => {
      setSelectedQuestionId(null);
      invalidate();
      flashBanner("Answer saved.");
    },
  });

  const completeMut = useMutation({
    mutationFn: () => completeSessionRequest(sessionId),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["session-analysis", sessionId] });
      flashBanner("Session complete. You can run AI evaluation when ready.");
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelSessionRequest(sessionId),
    onSuccess: () => {
      invalidate();
      flashBanner("Session cancelled.");
    },
  });

  if (sessionQuery.isLoading) {
    return <QueryLoadingHint>Loading session…</QueryLoadingHint>;
  }

  if (sessionQuery.isError || !session || !progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session unavailable</CardTitle>
          <CardDescription>
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "Could not load this session."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/sessions">
            <Button variant="outline" type="button">
              Back to sessions
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const s = session;
  const canSubmitAnswer =
    canMutate &&
    s.status === SessionStatus.ACTIVE &&
    !!currentQuestion &&
    (draft.transcript.trim().length > 0 || draft.audioUrl.trim().length > 0);

  const showComplete = canMutate && s.status === SessionStatus.ACTIVE && canCompleteSession(s);

  return (
    <div className="space-y-8">
      {actionBanner ? (
        <p
          className="bg-muted/60 text-foreground rounded-lg border px-3 py-2 text-sm"
          role="status"
        >
          {actionBanner}
        </p>
      ) : null}

      {!isOwner ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          You are viewing another learner&apos;s session (read-only).
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {s.title ?? s.template?.title ?? "Practice session"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {s.template ? SESSION_TYPE_LABEL[s.template.sessionType] : "Session"} ·{" "}
            {new Date(s.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="secondary">{SESSION_STATUS_LABEL[s.status]}</Badge>
      </div>

      {canMutate && s.status === SessionStatus.DRAFT ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={startMut.isPending}
              onClick={() => startMut.mutate()}
            >
              {startMut.isPending ? "Starting…" : "Start session"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Cancel
            </Button>
          </div>
          {startMut.isError ? (
            <p className="text-destructive text-sm">
              {startMut.error instanceof Error ? startMut.error.message : "Start failed"}
            </p>
          ) : null}
          {cancelMut.isError ? (
            <p className="text-destructive text-sm">
              {cancelMut.error instanceof Error ? cancelMut.error.message : "Cancel failed"}
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm">
            {questions.length} question{questions.length === 1 ? "" : "s"} in this template. After you
            start, use the transcript field for each prompt (recommended for demos). Optional: paste an
            external audio URL — there is no in-app recorder yet.
          </p>
        </div>
      ) : null}

      {canMutate && s.status === SessionStatus.ACTIVE ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={completeMut.isPending || !showComplete}
              onClick={() => completeMut.mutate()}
            >
              {completeMut.isPending ? "Completing…" : "Complete session"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Cancel
            </Button>
          </div>
          {!showComplete ? (
            <p className="text-muted-foreground text-sm">
              Answer all required questions with a transcript (and optionally an external audio URL) before
              completing.
            </p>
          ) : null}
          {completeMut.isError ? (
            <p className="text-destructive text-sm">
              {completeMut.error instanceof Error ? completeMut.error.message : "Complete failed"}
            </p>
          ) : null}
          {cancelMut.isError ? (
            <p className="text-destructive text-sm">
              {cancelMut.error instanceof Error ? cancelMut.error.message : "Cancel failed"}
            </p>
          ) : null}
        </div>
      ) : null}

      {s.status === SessionStatus.ACTIVE && progress.totalQuestions > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
            <CardDescription>
              {progress.answeredCount} of {progress.totalQuestions} with answers ·{" "}
              {progress.completionPercent}% complete · questions are answered in order
              {allQuestionsAnswered ? (
                <span className="mt-1 block">
                  All prompts answered — you can review or edit any, then complete the session.
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${Math.min(100, progress.completionPercent)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {questions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
            <CardDescription>
              Answer in order. Future steps stay locked until prior questions have content (usually a
              transcript). You can go back to edit earlier answers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {questionsOrdered.map((q) => {
              const answered = responseHasContent(responseByQuestion.get(q.id));
              const locked = isQuestionLocked(q);
              const isCurrent =
                s.status === SessionStatus.ACTIVE &&
                firstUnsatisfiedIdx >= 0 &&
                progress?.currentQuestionId === q.id;
              const active = q.id === effectiveQuestionId;
              const statusLabel = locked ? "Locked" : isCurrent ? "Current" : answered ? "Answered" : "Open";
              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (!locked) setSelectedQuestionId(q.id);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    locked && "cursor-not-allowed opacity-60",
                    active ? "border-primary bg-primary/5" : !locked && "hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p className="font-medium">
                      {q.ordinal}. {q.promptText}
                    </p>
                    {q.helpText ? (
                      <p className="text-muted-foreground mt-1 text-xs">{q.helpText}</p>
                    ) : null}
                  </div>
                  <Badge variant={locked ? "outline" : answered ? "secondary" : "outline"}>{statusLabel}</Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground text-sm">This template has no questions configured.</p>
      )}

      {canMutate && s.status === SessionStatus.ACTIVE && currentQuestion ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Question {currentQuestion.ordinal}
              {s.status === SessionStatus.ACTIVE &&
              firstUnsatisfiedIdx >= 0 &&
              progress?.currentQuestionId === currentQuestion.id ? (
                <span className="text-primary font-normal"> · Current</span>
              ) : s.status === SessionStatus.ACTIVE && firstUnsatisfiedIdx >= 0 ? (
                <span className="text-muted-foreground font-normal"> · Edit earlier answer</span>
              ) : s.status === SessionStatus.ACTIVE && firstUnsatisfiedIdx < 0 ? (
                <span className="text-muted-foreground font-normal"> · Review before completing</span>
              ) : null}
              {currentQuestion.isRequired ? (
                <span className="text-muted-foreground font-normal"> · Required</span>
              ) : null}
            </CardTitle>
            <CardDescription className="whitespace-pre-wrap">{currentQuestion.promptText}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQuestion.helpText ? (
              <p className="text-muted-foreground text-sm">{currentQuestion.helpText}</p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="answer-transcript">Transcript (primary — use this in demos)</Label>
              <textarea
                id="answer-transcript"
                rows={5}
                value={draft.transcript}
                onChange={(e) => setDraft((d) => ({ ...d, transcript: e.target.value }))}
                className={cn(
                  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder="Type or paste your answer as if you spoke it aloud."
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="answer-duration">Duration (seconds, optional)</Label>
                <input
                  id="answer-duration"
                  type="number"
                  min={0}
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                  value={draft.durationSec}
                  onChange={(e) => setDraft((d) => ({ ...d, durationSec: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="answer-audio-url">External audio URL (optional)</Label>
                <input
                  id="answer-audio-url"
                  type="url"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                  value={draft.audioUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, audioUrl: e.target.value }))}
                  placeholder="https://…"
                  title="Link to audio hosted elsewhere — not recorded in-app"
                />
                <p className="text-muted-foreground text-xs">
                  Metadata only: no upload or recording in this MVP.
                </p>
              </div>
            </div>
            <Button
              type="button"
              disabled={responseMut.isPending || !canSubmitAnswer}
              onClick={() => responseMut.mutate()}
            >
              {responseMut.isPending ? "Saving…" : "Save answer"}
            </Button>
            {responseMut.isError ? (
              <p className="text-destructive text-sm">
                {responseMut.error instanceof Error ? responseMut.error.message : "Save failed"}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <SessionAnalysisPanel
        sessionId={sessionId}
        sessionStatus={s.status}
        canRequest={!!canRequestAnalysis}
        canView={canViewAnalysis}
        isOwner={isOwner}
      />

      <div>
        <Link
          href="/sessions"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          ← Back to sessions
        </Link>
      </div>
    </div>
  );
}
