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
  type TrainingSessionRow,
} from "./sessions-api";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL } from "./session-labels";

function responseHasContent(r: { transcriptText: string | null; audioUrl: string | null }) {
  return Boolean(r.transcriptText?.trim() || r.audioUrl?.trim());
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
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);

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
  const allQuestionsAnswered =
    !!progress &&
    progress.totalQuestions > 0 &&
    progress.answeredCount >= progress.totalQuestions;

  const currentQuestionId = useMemo(() => {
    if (focusedQuestionId && questions.some((q) => q.id === focusedQuestionId)) {
      return focusedQuestionId;
    }
    if (progress?.currentQuestionId) {
      return progress.currentQuestionId;
    }
    return questions[0]?.id ?? null;
  }, [focusedQuestionId, progress?.currentQuestionId, questions]);

  const currentQuestion = questions.find((q) => q.id === currentQuestionId) ?? null;

  const responseByQuestion = useMemo(() => {
    return new Map((session?.responses ?? []).map((r) => [r.templateQuestionId, r]));
  }, [session?.responses]);

  useEffect(() => {
    if (!currentQuestionId) return;
    const r = responseByQuestion.get(currentQuestionId);
    if (r) {
      setDraft({
        transcript: r.transcriptText ?? "",
        durationSec: r.durationSec != null ? String(r.durationSec) : "",
        audioUrl: r.audioUrl ?? "",
      });
    } else {
      setDraft({ transcript: "", durationSec: "", audioUrl: "" });
    }
  }, [currentQuestionId, responseByQuestion]);

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
      flashBanner("Session started — work through each question in order.");
    },
  });

  const responseMut = useMutation({
    mutationFn: () => {
      if (!currentQuestion) throw new Error("No question selected");
      const durationRaw = draft.durationSec.trim();
      const durationParsed = durationRaw ? Number(durationRaw) : undefined;
      return submitSessionResponseRequest(sessionId, {
        templateQuestionId: currentQuestion.id,
        transcriptText: draft.transcript.trim() || undefined,
        audioUrl: draft.audioUrl.trim() || undefined,
        durationSec:
          durationParsed !== undefined && Number.isFinite(durationParsed) ? durationParsed : undefined,
      });
    },
    onSuccess: () => {
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
            {questions.length} question{questions.length === 1 ? "" : "s"} in this template. After
            you start, record or type your answer for each prompt.
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
              Answer all required questions with a transcript or audio reference before completing.
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
              {progress.answeredCount} of {progress.totalQuestions} answered ·{" "}
              {progress.completionPercent}% complete
              {allQuestionsAnswered ? (
                <span className="mt-1 block">
                  All required prompts have answers — review or edit any, then complete.
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
            <CardDescription>Select a question to view or update your answer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {questions.map((q) => {
              const answered = responseByQuestion.has(q.id);
              const active = q.id === currentQuestionId;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setFocusedQuestionId(q.id)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    active ? "border-primary bg-primary/5" : "hover:bg-muted/50",
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
                  <Badge variant={answered ? "secondary" : "outline"}>
                    {answered ? "Answered" : "Open"}
                  </Badge>
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
              <Label htmlFor="answer-transcript">Transcript (what you said or will say)</Label>
              <textarea
                id="answer-transcript"
                rows={5}
                value={draft.transcript}
                onChange={(e) => setDraft((d) => ({ ...d, transcript: e.target.value }))}
                className={cn(
                  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder="Type or paste your spoken answer here for this MVP (voice capture comes later)."
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
                <Label htmlFor="answer-audio-url">Audio URL (optional)</Label>
                <input
                  id="answer-audio-url"
                  type="url"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                  value={draft.audioUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, audioUrl: e.target.value }))}
                  placeholder="https://…"
                />
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
