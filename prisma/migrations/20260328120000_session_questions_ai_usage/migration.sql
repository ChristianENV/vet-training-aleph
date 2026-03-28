-- Session domain: per-session generated questions, expanded responses, AI usage + incident logging.
-- Destructive: drops legacy SessionResponse + SessionTemplateQuestion (no data migration).

DROP TABLE IF EXISTS "SessionResponse" CASCADE;
DROP TABLE IF EXISTS "SessionTemplateQuestion" CASCADE;

CREATE TYPE "AiOperationType" AS ENUM ('GENERATE_QUESTIONS', 'EVALUATE_SESSION', 'TRANSCRIBE_AUDIO');
CREATE TYPE "AiUsageLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE "TranscriptStatus" AS ENUM ('NONE', 'PENDING', 'AVAILABLE', 'FAILED');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "SessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "promptText" TEXT NOT NULL,
    "helpText" TEXT,
    "expectedDurationSec" INTEGER,
    "suggestedDurationSec" INTEGER,
    "maxDurationSec" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "generatedByModel" TEXT,
    "sourceTopic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionQuestion_sessionId_ordinal_key" ON "SessionQuestion"("sessionId", "ordinal");
CREATE INDEX "SessionQuestion_sessionId_idx" ON "SessionQuestion"("sessionId");

ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SessionResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionQuestionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "transcriptText" TEXT,
    "transcriptStatus" "TranscriptStatus",
    "transcriptProvider" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "finalAudioStorageKey" TEXT,
    "finalAudioProvider" TEXT,
    "finalAudioMimeType" TEXT,
    "finalAudioBytes" INTEGER,
    "finalAudioDurationSec" INTEGER,
    "finalAudioCodec" TEXT,
    "audioUploadedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionResponse_sessionId_sessionQuestionId_key" ON "SessionResponse"("sessionId", "sessionQuestionId");
CREATE INDEX "SessionResponse_sessionId_idx" ON "SessionResponse"("sessionId");
CREATE INDEX "SessionResponse_sessionQuestionId_idx" ON "SessionResponse"("sessionQuestionId");

ALTER TABLE "SessionResponse" ADD CONSTRAINT "SessionResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionResponse" ADD CONSTRAINT "SessionResponse_sessionQuestionId_fkey" FOREIGN KEY ("sessionQuestionId") REFERENCES "SessionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "operationType" "AiOperationType" NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "analysisId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "currency" TEXT DEFAULT 'USD',
    "status" "AiUsageLogStatus" NOT NULL,
    "requestMetaJson" JSONB,
    "responseMetaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");
CREATE INDEX "AiUsageLog_sessionId_createdAt_idx" ON "AiUsageLog"("sessionId", "createdAt");
CREATE INDEX "AiUsageLog_analysisId_idx" ON "AiUsageLog"("analysisId");
CREATE INDEX "AiUsageLog_operationType_idx" ON "AiUsageLog"("operationType");

ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "SessionAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TechnicalIncident" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "sessionQuestionId" TEXT,
    "stage" TEXT NOT NULL,
    "provider" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "detailsJson" JSONB,
    "severity" "IncidentSeverity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TechnicalIncident_sessionId_idx" ON "TechnicalIncident"("sessionId");
CREATE INDEX "TechnicalIncident_sessionQuestionId_idx" ON "TechnicalIncident"("sessionQuestionId");
CREATE INDEX "TechnicalIncident_severity_createdAt_idx" ON "TechnicalIncident"("severity", "createdAt");
CREATE INDEX "TechnicalIncident_stage_idx" ON "TechnicalIncident"("stage");

ALTER TABLE "TechnicalIncident" ADD CONSTRAINT "TechnicalIncident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicalIncident" ADD CONSTRAINT "TechnicalIncident_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicalIncident" ADD CONSTRAINT "TechnicalIncident_sessionQuestionId_fkey" FOREIGN KEY ("sessionQuestionId") REFERENCES "SessionQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
