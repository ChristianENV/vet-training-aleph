"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMicrophonePreflight } from "@/hooks/use-microphone-preflight";
import type { OralRecorderResult } from "@/hooks/use-oral-recorder";
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
import { useSessionUser } from "@/hooks/use-session-user";
import { roleHasPermission } from "@/lib/auth/permissions";
import { ApiRequestError } from "@/lib/http/api-client";
import { SessionAnalysisPanel } from "@/modules/analyses/presentation/session-analysis-panel";
import {
  cancelSessionRequest,
  fetchSessionDetail,
  finalizeSessionRequest,
  resumePostFinalizeRequest,
  startSessionRequest,
  submitSessionResponseRequest,
  type TrainingSessionRow,
} from "./sessions-api";
import { MicrophonePrepCard } from "./microphone-prep-card";
import { OralAssessmentWizard } from "./oral-assessment-wizard";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL } from "./session-labels";
import { formatSessionQuestionCountRange } from "./session-question-generation-copy";
import {
  hasUnsavedLocalVoiceTake,
  indexOfFirstUnsatisfied,
  responseHasContent,
  type LocalVoiceTake,
} from "./session-wizard-helpers";

function finalizeFinishErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 503 && error.code === "SERVICE_UNAVAILABLE") {
    return "Your answers were saved, but scoring is not available right now. Try finishing again in a moment, or use “Run evaluation again” below.";
  }
  if (error instanceof ApiRequestError && error.status === 422 && error.code === "FINALIZE_RECOVERABLE") {
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not finish assessment";
}

function canCompleteSession(session: TrainingSessionRow): boolean {
  const qs = session.sessionQuestions ?? [];
  const required = qs.filter((q) => q.isRequired);
  const byId = new Map((session.responses ?? []).map((r) => [r.sessionQuestionId, r]));
  return required.every((q) => {
    const r = byId.get(q.id);
    return r && responseHasContent(r);
  });
}

type Props = {
  sessionId: string;
  /** Matches server env used when starting question generation (for accurate loading copy). */
  questionGenerationBounds: { min: number; max: number };
};

export function SessionDetail({ sessionId, questionGenerationBounds }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: auth } = useSessionUser();
  const [localByQuestion, setLocalByQuestion] = useState<Map<string, LocalVoiceTake>>(() => new Map());
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const localByQuestionRef = useRef(localByQuestion);
  localByQuestionRef.current = localByQuestion;

  const sessionQuery = useQuery({
    queryKey: ["training-session", sessionId],
    queryFn: () => fetchSessionDetail(sessionId),
    refetchInterval: (q) => {
      const data = q.state.data as { session?: { status?: SessionStatus } } | undefined;
      const st = data?.session?.status;
      if (st === SessionStatus.GENERATING_QUESTIONS) return 2000;
      if (
        st === SessionStatus.SAVING_FINAL_RESPONSES ||
        st === SessionStatus.TRANSCRIBING ||
        st === SessionStatus.TRANSCRIPTION_FAILED ||
        st === SessionStatus.ANALYZING
      ) {
        return 2000;
      }
      return false;
    },
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

  const questions = session?.sessionQuestions ?? [];
  const questionsOrdered = useMemo(
    () => [...questions].sort((a, b) => a.ordinal - b.ordinal),
    [questions],
  );

  const responseByQuestion = useMemo(() => {
    return new Map((session?.responses ?? []).map((r) => [r.sessionQuestionId, r]));
  }, [session?.responses]);

  const firstUnsatisfiedIdx = useMemo(
    () => indexOfFirstUnsatisfied(questions, responseByQuestion),
    [questions, responseByQuestion],
  );

  const isQuestionLocked = useCallback(
    (q: (typeof questionsOrdered)[0]) => {
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
    return () => {
      for (const t of localByQuestionRef.current.values()) {
        URL.revokeObjectURL(t.objectUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedQuestionId || session?.status !== SessionStatus.ACTIVE) return;
    if (firstUnsatisfiedIdx < 0) return;
    const selIdx = questionsOrdered.findIndex((q) => q.id === selectedQuestionId);
    if (selIdx > firstUnsatisfiedIdx) {
      setSelectedQuestionId(null);
    }
  }, [firstUnsatisfiedIdx, questionsOrdered, session?.status, selectedQuestionId]);

  const localTakeForEffective = effectiveQuestionId
    ? localByQuestion.get(effectiveQuestionId) ?? null
    : null;

  const handleVoiceTakeReady = useCallback(
    (result: OralRecorderResult) => {
      if (!effectiveQuestionId) return;
      setLocalByQuestion((prev) => {
        const next = new Map(prev);
        const old = next.get(effectiveQuestionId);
        if (old?.objectUrl) URL.revokeObjectURL(old.objectUrl);
        const objectUrl = URL.createObjectURL(result.blob);
        next.set(effectiveQuestionId, {
          ...result,
          objectUrl,
        });
        return next;
      });
    },
    [effectiveQuestionId],
  );

  const discardVoiceTakeForEffective = useCallback(() => {
    if (!effectiveQuestionId) return;
    setLocalByQuestion((prev) => {
      const next = new Map(prev);
      const old = next.get(effectiveQuestionId);
      if (old?.objectUrl) URL.revokeObjectURL(old.objectUrl);
      next.delete(effectiveQuestionId);
      return next;
    });
  }, [effectiveQuestionId]);

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

  const {
    status: micPreflightStatus,
    detailMessage: micPreflightDetail,
    checkMicrophone,
    reset: resetMicPreflight,
  } = useMicrophonePreflight();

  useEffect(() => {
    resetMicPreflight();
  }, [sessionId, resetMicPreflight]);

  useEffect(() => {
    if (session?.status !== SessionStatus.DRAFT) {
      resetMicPreflight();
    }
  }, [session?.status, resetMicPreflight]);

  const startMut = useMutation({
    mutationFn: () => startSessionRequest(sessionId),
    onSuccess: () => {
      invalidate();
      flashBanner("Questions ready — work through each oral prompt in order.");
    },
  });

  const responseMut = useMutation({
    mutationFn: () => {
      if (!currentQuestion || !effectiveQuestionId) throw new Error("No question selected");
      const take = localByQuestion.get(effectiveQuestionId);
      if (!take) throw new Error("Record your answer before saving");
      return submitSessionResponseRequest(sessionId, {
        sessionQuestionId: currentQuestion.id,
        finalAudioDurationSec: Math.max(1, Math.round(take.durationSec)),
        finalAudioMimeType: take.mimeType,
        finalAudioBytes: take.byteLength,
      });
    },
    onSuccess: () => {
      setSelectedQuestionId(null);
      invalidate();
      flashBanner("Answer saved.");
    },
  });

  const completeMut = useMutation({
    mutationFn: () => {
      if (!session) throw new Error("Session not loaded");
      const fd = new FormData();
      const required = (session.sessionQuestions ?? []).filter((q) => q.isRequired);
      const byResp = new Map((session.responses ?? []).map((r) => [r.sessionQuestionId, r]));
      for (const q of required) {
        const r = byResp.get(q.id);
        const take = localByQuestion.get(q.id);
        if (!r?.finalAudioStorageKey?.trim() && take?.blob) {
          fd.append(`audio_${q.id}`, take.blob, `question-${q.ordinal}.webm`);
        }
      }
      return finalizeSessionRequest(sessionId, fd);
    },
    onSuccess: (data) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["session-analysis", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["analyses-list"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      if (data.transcriptionFailed) {
        flashBanner(
          "We saved your responses, but couldn’t prepare them for scoring yet. Use Try preparing again when you’re ready.",
        );
        return;
      }
      const analysisId = data.evaluation?.analysis?.id;
      if (analysisId) {
        router.push(`/analyses/${analysisId}`);
      } else {
        flashBanner("Your assessment is saved. Check this page for results or the analyses list.");
      }
    },
  });

  const resumeMut = useMutation({
    mutationFn: () => resumePostFinalizeRequest(sessionId),
    onSuccess: (data) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["session-analysis", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["analyses-list"] });
      void queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      if (data.transcriptionFailed) {
        flashBanner("We still couldn’t prepare your answers for scoring. Please try again in a moment.");
        return;
      }
      const analysisId = data.evaluation?.analysis?.id;
      if (analysisId) {
        router.push(`/analyses/${analysisId}`);
      } else {
        flashBanner("Your results are ready when you are — open this session or your analyses list.");
      }
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
  const savedForEffective = effectiveQuestionId ? responseByQuestion.get(effectiveQuestionId) : undefined;
  const attemptsExhausted =
    !!savedForEffective && savedForEffective.attemptCount >= savedForEffective.maxAttempts;

  const hasUnsavedLocalTake = localTakeForEffective
    ? hasUnsavedLocalVoiceTake(localTakeForEffective, savedForEffective)
    : false;

  const canSubmitAnswer =
    canMutate &&
    s.status === SessionStatus.ACTIVE &&
    !!currentQuestion &&
    !!localTakeForEffective &&
    !attemptsExhausted &&
    hasUnsavedLocalTake;

  const saveBlockedReason = attemptsExhausted
    ? "No attempts remaining for this prompt."
    : !localTakeForEffective
      ? "Record your answer before saving."
      : !hasUnsavedLocalTake
        ? "Save when you have a new or updated recording."
        : null;

  const showComplete = canMutate && s.status === SessionStatus.ACTIVE && canCompleteSession(s);

  const showWizard = s.status === SessionStatus.ACTIVE && questionsOrdered.length > 0;

  const responseError =
    responseMut.isError && responseMut.error instanceof Error ? responseMut.error.message : null;

  const finalizeError =
    completeMut.isError && canMutate && s.status === SessionStatus.ACTIVE
      ? finalizeFinishErrorMessage(completeMut.error)
      : null;

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

      {completeMut.isPending || resumeMut.isPending ? (
        <p
          className="bg-muted/60 text-foreground rounded-lg border px-3 py-2 text-sm"
          role="status"
        >
          {resumeMut.isPending
            ? "Preparing your answers for scoring. This may take a minute—please keep this page open."
            : "Saving your responses, then preparing transcripts and your results. This may take a minute—please keep this page open."}
        </p>
      ) : null}

      {s.status === SessionStatus.SAVING_FINAL_RESPONSES ||
      s.status === SessionStatus.TRANSCRIBING ||
      s.status === SessionStatus.ANALYZING ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {s.status === SessionStatus.SAVING_FINAL_RESPONSES
                ? "Saving your responses"
                : s.status === SessionStatus.TRANSCRIBING
                  ? "Transcribing your answers"
                  : "Analyzing your evaluation"}
            </CardTitle>
            <CardDescription>
              {s.status === SessionStatus.SAVING_FINAL_RESPONSES
                ? "We are storing your recordings securely. Please keep this window open."
                : s.status === SessionStatus.TRANSCRIBING
                  ? "We are turning your voice answers into text so scoring can be fair and detailed. This usually takes less than a minute."
                  : "We are preparing your score and coaching feedback. This usually completes within a minute."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QueryLoadingHint>Please wait…</QueryLoadingHint>
          </CardContent>
        </Card>
      ) : null}

      {s.status === SessionStatus.TRANSCRIPTION_FAILED ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">We saved your responses</CardTitle>
            <CardDescription>
              We couldn&apos;t finish preparing them for scoring just yet. Nothing needs to be re-recorded —
              try again in a moment. If this keeps happening, contact support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canMutate ? (
              <Button
                type="button"
                disabled={resumeMut.isPending || completeMut.isPending}
                onClick={() => resumeMut.mutate()}
              >
                {resumeMut.isPending ? "Trying again…" : "Try preparing again"}
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">Only the session owner can retry from here.</p>
            )}
            {resumeMut.isError ? (
              <p className="text-destructive mt-2 text-sm">
                {resumeMut.error instanceof Error ? resumeMut.error.message : "Request failed"}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!isOwner ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          You are viewing another learner&apos;s session (read-only).
        </p>
      ) : null}

      {s.status === SessionStatus.GENERATING_QUESTIONS ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preparing your oral prompts</CardTitle>
            <CardDescription>
              We are generating a fresh set of{" "}
              {formatSessionQuestionCountRange(
                questionGenerationBounds.min,
                questionGenerationBounds.max,
              )}{" "}
              for this topic, informed by your past practice on the same subject when available. This usually
              takes a few seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QueryLoadingHint>Please wait…</QueryLoadingHint>
          </CardContent>
        </Card>
      ) : null}

      {!showWizard ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {s.title ?? s.template?.title ?? "Oral assessment"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {s.template ? SESSION_TYPE_LABEL[s.template.sessionType] : "Session"} ·{" "}
              {new Date(s.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">{SESSION_STATUS_LABEL[s.status]}</Badge>
        </div>
      ) : null}

      {canMutate && s.status === SessionStatus.DRAFT ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Next, we&apos;ll check your microphone, then build{" "}
            {formatSessionQuestionCountRange(
              questionGenerationBounds.min,
              questionGenerationBounds.max,
            )}{" "}
            for this run. You&apos;ll answer one prompt at a time in a guided flow (voice-first; support fields
            are optional).
          </p>
          <MicrophonePrepCard
            status={micPreflightStatus}
            detailMessage={micPreflightDetail}
            checking={micPreflightStatus === "checking"}
            starting={startMut.isPending}
            onCheckMicrophone={() => void checkMicrophone()}
            onContinue={() => startMut.mutate()}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={cancelMut.isPending || startMut.isPending}
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
        </div>
      ) : null}

      {responseError ? (
        <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
          {responseError}
        </p>
      ) : null}
      {finalizeError ? (
        <p
          className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm"
          role="alert"
        >
          {finalizeError}
        </p>
      ) : null}
      {showWizard && cancelMut.isError ? (
        <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border px-3 py-2 text-sm">
          {cancelMut.error instanceof Error ? cancelMut.error.message : "Cancel failed"}
        </p>
      ) : null}

      {showWizard ? (
        <OralAssessmentWizard
          session={s}
          progress={progress}
          questionsOrdered={questionsOrdered}
          responseByQuestion={responseByQuestion}
          effectiveQuestionId={effectiveQuestionId}
          currentQuestion={currentQuestion}
          firstUnsatisfiedIdx={firstUnsatisfiedIdx}
          isQuestionLocked={isQuestionLocked}
          onSelectQuestion={(id) => setSelectedQuestionId(id)}
          localTake={localTakeForEffective}
          onVoiceTakeReady={handleVoiceTakeReady}
          onDiscardVoiceTake={discardVoiceTakeForEffective}
          canMutate={canMutate}
          onSaveAnswer={() => responseMut.mutate()}
          responseMutPending={responseMut.isPending}
          canSubmitAnswer={canSubmitAnswer}
          saveBlockedReason={saveBlockedReason}
          hasUnsavedLocalTake={hasUnsavedLocalTake}
          showComplete={showComplete}
          onComplete={() => completeMut.mutate()}
          completeMutPending={completeMut.isPending}
          onCancel={() => cancelMut.mutate()}
          cancelMutPending={cancelMut.isPending}
        />
      ) : null}

      {s.status === SessionStatus.ACTIVE && questionsOrdered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This session is active but has no prompts yet. Try refreshing, or contact support if the problem
          persists.
        </p>
      ) : null}

      {canMutate && s.status === SessionStatus.ACTIVE && !showWizard ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={completeMut.isPending || !showComplete}
              onClick={() => completeMut.mutate()}
            >
              {completeMut.isPending ? "Saving…" : "Finish assessment"}
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
        </div>
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
