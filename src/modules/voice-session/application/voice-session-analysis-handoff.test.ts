import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisStatus, SessionStatus, SessionType } from "@/generated/prisma/enums";
import { AnalysisServiceError } from "@/modules/analyses/application/analysis-errors";

const getServerEnvMock = vi.fn();
const runSessionEvaluationModelMock = vi.fn();
const estimateCostMock = vi.fn();
const recordUsageMock = vi.fn();
const sessionRepoMock = {
  getSessionById: vi.fn(),
  listSessionTurns: vi.fn(),
  updateSessionStatus: vi.fn(),
};
const analysisRepoMock = {
  ANALYSIS_SCHEMA_VERSION: 1,
  ANALYSIS_RESULT_KIND: "session-evaluation",
  findRunningAnalysisForSession: vi.fn(),
  findLatestAnalysisBySessionId: vi.fn(),
  createRunningAnalysis: vi.fn(),
  markAnalysisCompleted: vi.fn(),
  markAnalysisFailed: vi.fn(),
};

vi.mock("@/lib/config/env", () => ({ getServerEnv: getServerEnvMock }));
vi.mock("@/modules/openai", () => ({
  runSessionEvaluationModel: runSessionEvaluationModelMock,
  estimateOpenAiMiniCostUsdFromUsage: estimateCostMock,
}));
vi.mock("@/modules/analyses/infrastructure/evaluation-ai-usage-logging", () => ({
  recordSessionEvaluationAiUsage: recordUsageMock,
}));
vi.mock("@/modules/sessions/infrastructure/session-repository", () => sessionRepoMock);
vi.mock("@/modules/analyses/infrastructure/session-analysis-repository", () => analysisRepoMock);

describe("triggerVoiceSessionAnalysis", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerEnvMock.mockReturnValue({ OPENAI_API_KEY: "k", OPENAI_EVAL_MODEL: "gpt-4.1-mini" });
    sessionRepoMock.getSessionById.mockResolvedValue({
      id: "s1",
      userId: "u1",
      title: "Session",
      template: { title: "Template", sessionType: SessionType.GUIDED_DIALOGUE },
    });
    analysisRepoMock.findRunningAnalysisForSession.mockResolvedValue(null);
    analysisRepoMock.findLatestAnalysisBySessionId.mockResolvedValue(null);
    sessionRepoMock.updateSessionStatus.mockResolvedValue({});
  });

  it("triggers analysis when final turn data exists", async () => {
    sessionRepoMock.listSessionTurns.mockResolvedValue([
      {
        id: "t1",
        speaker: "user",
        text: "I am checking the patient.",
        isFinal: true,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        sequence: 1,
      },
      {
        id: "t2",
        speaker: "assistant",
        text: "Please continue.",
        isFinal: true,
        createdAt: new Date("2026-04-22T10:00:02.000Z"),
        sequence: 2,
      },
    ]);
    analysisRepoMock.createRunningAnalysis.mockResolvedValue({ id: "a1" });
    runSessionEvaluationModelMock.mockResolvedValue({
      rawText: "ok",
      evaluation: { sessionSummary: "good" },
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    analysisRepoMock.findLatestAnalysisBySessionId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "a1",
      status: AnalysisStatus.COMPLETED,
      errorMessage: null,
    });

    const { triggerVoiceSessionAnalysis } = await import("./voice-session-analysis-handoff");
    const out = await triggerVoiceSessionAnalysis({ id: "u1" } as any, "s1");

    expect(runSessionEvaluationModelMock).toHaveBeenCalled();
    expect(out.evaluationRun.outcome).toBe("SUCCEEDED");
    expect(sessionRepoMock.updateSessionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: SessionStatus.ANALYZING }),
    );
  });

  it("skips duplicate trigger when already running/completed", async () => {
    analysisRepoMock.findRunningAnalysisForSession.mockResolvedValueOnce({
      id: "a-running",
      status: AnalysisStatus.RUNNING,
    });
    const { triggerVoiceSessionAnalysis } = await import("./voice-session-analysis-handoff");
    const runningOut = await triggerVoiceSessionAnalysis({ id: "u1" } as any, "s1");
    expect(runningOut.skipped).toBe(true);

    analysisRepoMock.findRunningAnalysisForSession.mockResolvedValueOnce(null);
    analysisRepoMock.findLatestAnalysisBySessionId.mockResolvedValueOnce({
      id: "a-done",
      status: AnalysisStatus.COMPLETED,
      errorMessage: null,
    });
    const completedOut = await triggerVoiceSessionAnalysis({ id: "u1" } as any, "s1");
    expect(completedOut.skipped).toBe(true);
  });

  it("throws for insufficient final turns", async () => {
    sessionRepoMock.listSessionTurns.mockResolvedValue([
      {
        id: "t1",
        speaker: "user",
        text: "interim only",
        isFinal: false,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        sequence: 1,
      },
    ]);
    const { triggerVoiceSessionAnalysis } = await import("./voice-session-analysis-handoff");
    await expect(triggerVoiceSessionAnalysis({ id: "u1" } as any, "s1")).rejects.toBeInstanceOf(
      AnalysisServiceError,
    );
  });

  it("marks failure with stable semantics when model call fails", async () => {
    sessionRepoMock.listSessionTurns.mockResolvedValue([
      {
        id: "t1",
        speaker: "user",
        text: "final text",
        isFinal: true,
        createdAt: new Date("2026-04-22T10:00:00.000Z"),
        sequence: 1,
      },
    ]);
    analysisRepoMock.createRunningAnalysis.mockResolvedValue({ id: "a1" });
    runSessionEvaluationModelMock.mockRejectedValue(new Error("model down"));
    analysisRepoMock.findLatestAnalysisBySessionId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "a1",
      status: AnalysisStatus.FAILED,
      errorMessage: "model down",
    });

    const { triggerVoiceSessionAnalysis } = await import("./voice-session-analysis-handoff");
    const out = await triggerVoiceSessionAnalysis({ id: "u1" } as any, "s1");

    expect(analysisRepoMock.markAnalysisFailed).toHaveBeenCalledWith("a1", "model down");
    expect(out.evaluationRun.outcome).toBe("FAILED");
  });
});

