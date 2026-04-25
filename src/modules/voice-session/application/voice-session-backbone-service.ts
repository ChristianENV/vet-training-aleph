import type { Prisma } from "@/generated/prisma/client";
import { AnalysisStatus } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/authenticated-user";
import { getSessionByIdOrThrow, SessionsServiceError } from "@/modules/sessions/application/session-service";
import * as sessionRepo from "@/modules/sessions/infrastructure/session-repository";
import * as analysisRepo from "@/modules/analyses/infrastructure/session-analysis-repository";
import { createRealtimeSessionBootstrap } from "@/modules/openai/application/create-realtime-session-bootstrap";
import { VOICE_EVENT_TYPES } from "@/modules/voice-session/domain/voice-event-types";
import { buildAnalysisItemsFromVoiceTurns } from "./voice-transcript-analysis-adapter";
import { triggerVoiceSessionAnalysis } from "./voice-session-analysis-handoff";

export type PersistVoiceEventInput = {
  type: string;
  clientEventId: string;
  payload?: Record<string, unknown>;
};

export type PersistVoiceTurnInput = {
  speaker: "assistant" | "user" | "system";
  text: string;
  isFinal: boolean;
  clientTurnId?: string;
};

function assertVoiceOwner(actor: AuthenticatedUser, session: { userId: string }) {
  if (session.userId !== actor.id) {
    throw new SessionsServiceError(403, "You can only use voice controls on your own session", "FORBIDDEN");
  }
}

export async function connectVoiceBackbone(actor: AuthenticatedUser, sessionId: string) {
  const session = await getSessionByIdOrThrow(actor, sessionId);
  assertVoiceOwner(actor, session);

  const connectionId = `voice_${sessionId}_${Date.now()}`;
  await sessionRepo.appendSessionEvent({
    sessionId,
    type: VOICE_EVENT_TYPES.SESSION_CONNECT_REQUESTED,
    clientEventId: `${connectionId}:connect_requested`,
    payloadJson: { connectionId, requestedAt: new Date().toISOString() } as Prisma.InputJsonValue,
  });

  try {
    const bootstrap = await createRealtimeSessionBootstrap({
      sessionId,
      sessionTitle: session.title ?? null,
    });
    await sessionRepo.appendSessionEvent({
      sessionId,
      type: VOICE_EVENT_TYPES.SESSION_BOOTSTRAP_READY,
      clientEventId: `${connectionId}:bootstrap_ready`,
      payloadJson: {
        connectionId,
        model: bootstrap.model,
        voice: bootstrap.voice,
      } as Prisma.InputJsonValue,
    });

    const [turns, events] = await Promise.all([
      sessionRepo.listSessionTurns(sessionId, 80),
      sessionRepo.listSessionEvents(sessionId, 120),
    ]);

    return { session, connectionId, turns, events, bootstrap };
  } catch (e) {
    await sessionRepo.appendSessionEvent({
      sessionId,
      type: VOICE_EVENT_TYPES.SESSION_CONNECT_FAILED,
      clientEventId: `${connectionId}:connect_failed`,
      payloadJson: {
        connectionId,
        error: e instanceof Error ? e.message : "Unknown error",
      } as Prisma.InputJsonValue,
    });
    throw e;
  }
}

export async function persistVoiceEvent(
  actor: AuthenticatedUser,
  sessionId: string,
  event: PersistVoiceEventInput,
  turn?: PersistVoiceTurnInput,
) {
  const session = await getSessionByIdOrThrow(actor, sessionId);
  assertVoiceOwner(actor, session);

  const savedEvent = await sessionRepo.appendSessionEvent({
    sessionId,
    type: event.type,
    clientEventId: event.clientEventId,
    payloadJson: (event.payload ?? {}) as Prisma.InputJsonValue,
  });

  let savedTurn:
    | Awaited<ReturnType<typeof sessionRepo.appendSessionTurn>>
    | null = null;

  if (turn && turn.text.trim()) {
    const saved = await sessionRepo.appendSessionTurn({
      sessionId,
      speaker: turn.speaker,
      text: turn.text.trim(),
      isFinal: turn.isFinal,
      clientTurnId: turn.clientTurnId,
      sourceClientEventId: event.clientEventId,
    });
    savedTurn = saved.turn;
  } else if (savedEvent.deduped) {
    const existingTurn = await sessionRepo.findSessionTurnBySourceClientEventId(
      sessionId,
      event.clientEventId,
    );
    savedTurn = existingTurn;
  }

  return { savedEvent: savedEvent.event, savedTurn, deduped: savedEvent.deduped };
}

export async function endVoiceBackbone(actor: AuthenticatedUser, sessionId: string) {
  const session = await getSessionByIdOrThrow(actor, sessionId);
  assertVoiceOwner(actor, session);

  const existingEndedEvent = await sessionRepo.findLatestSessionEventByType(
    sessionId,
    VOICE_EVENT_TYPES.SESSION_ENDED,
  );
  const alreadyEnded = !!existingEndedEvent;
  if (alreadyEnded) {
    const latestAnalysis = await analysisRepo.findLatestAnalysisBySessionId(sessionId);
    return {
      session,
      turns: await sessionRepo.listSessionTurns(sessionId, 200),
      endedEvent: null,
      analysisHandoff: {
        route: `/api/sessions/${sessionId}/analysis/evaluate`,
        autoTriggered: false,
        prepared: true,
        itemCount: 0,
        analysisId: latestAnalysis?.id ?? null,
        outcome:
          latestAnalysis?.status === AnalysisStatus.COMPLETED
            ? ("SUCCEEDED" as const)
            : latestAnalysis?.status === AnalysisStatus.FAILED
              ? ("FAILED" as const)
              : null,
        sampleItems: [],
      },
      idempotentReplay: true as const,
    };
  }

  await sessionRepo.appendSessionEvent({
    sessionId,
    type: VOICE_EVENT_TYPES.SESSION_ENDING,
    clientEventId: `voice-end:${sessionId}`,
    payloadJson: { requestedAt: new Date().toISOString() } as Prisma.InputJsonValue,
  });

  const turns = await sessionRepo.listSessionTurns(sessionId, 200);
  const analysisItems = buildAnalysisItemsFromVoiceTurns(
    turns.map((t) => ({
      id: t.id,
      speaker: t.speaker as "assistant" | "user" | "system",
      text: t.text,
      createdAt: t.createdAt.toISOString(),
      isFinal: t.isFinal,
      sequence: t.sequence,
    })),
  );

  await sessionRepo.mergeSessionFinalizationMeta(sessionId, {
    voiceHandoff: {
      preparedAt: new Date().toISOString(),
      turnCount: turns.length,
      analysisItemCount: analysisItems.length,
      source: "voice-session-backbone-v1",
    },
  });

  const endedEvent = await sessionRepo.appendSessionEvent({
    sessionId,
    type: VOICE_EVENT_TYPES.SESSION_ENDED,
    clientEventId: `voice-ended:${sessionId}`,
    payloadJson: {
      analysisItemCount: analysisItems.length,
      turnCount: turns.length,
    } as Prisma.InputJsonValue,
  });

  let analysisResult:
    | Awaited<ReturnType<typeof triggerVoiceSessionAnalysis>>
    | null = null;
  if (analysisItems.length > 0) {
    try {
      await sessionRepo.appendSessionEvent({
        sessionId,
        type: "analysis.trigger_requested",
        clientEventId: `voice-analysis-requested:${sessionId}`,
        payloadJson: { analysisItemCount: analysisItems.length } as Prisma.InputJsonValue,
      });
      analysisResult = await triggerVoiceSessionAnalysis(actor, sessionId);
      await sessionRepo.appendSessionEvent({
        sessionId,
        type: "analysis.trigger_succeeded",
        clientEventId: `voice-analysis-succeeded:${sessionId}`,
        payloadJson: {
          analysisId: analysisResult.analysis.id,
          outcome: analysisResult.evaluationRun.outcome,
        } as Prisma.InputJsonValue,
      });
    } catch {
      analysisResult = null;
      await sessionRepo.appendSessionEvent({
        sessionId,
        type: "analysis.trigger_failed",
        clientEventId: `voice-analysis-failed:${sessionId}`,
        payloadJson: {
          reason: "voice_analysis_trigger_failed",
        } as Prisma.InputJsonValue,
      });
    }
  }

  return {
    session,
    turns,
    endedEvent: endedEvent.event,
    analysisHandoff: {
      route: `/api/sessions/${sessionId}/analysis/evaluate`,
      autoTriggered: !!(analysisResult && !analysisResult.skipped),
      prepared: analysisItems.length > 0,
      itemCount: analysisItems.length,
      analysisId: analysisResult?.analysis.id ?? null,
      outcome: analysisResult?.evaluationRun.outcome ?? null,
      sampleItems: analysisItems.slice(0, 3),
    },
    idempotentReplay: false as const,
  };
}

