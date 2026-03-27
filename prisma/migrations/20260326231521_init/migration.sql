-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'PRODUCT_OWNER', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('GUIDED_DIALOGUE', 'ROLE_PLAY', 'VOCABULARY_DRILL', 'CASE_REVIEW');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InputMode" AS ENUM ('TEXT', 'VOICE', 'MIXED');

-- CreateEnum
CREATE TYPE "ReadinessLevel" AS ENUM ('FOUNDATION', 'DEVELOPING', 'PROFICIENT', 'WORK_READY');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "isProtectedAccount" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredLocale" TEXT,
    "professionalBio" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sessionType" "SessionType" NOT NULL,
    "configJson" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTemplateQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "promptText" TEXT NOT NULL,
    "helpText" TEXT,
    "expectedDurationSec" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "SessionStatus" NOT NULL,
    "inputMode" "InputMode" NOT NULL DEFAULT 'VOICE',
    "title" TEXT,
    "locale" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "templateQuestionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "transcriptText" TEXT,
    "durationSec" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAnalysis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "summary" TEXT,
    "payloadJson" JSONB,
    "schemaVersion" TEXT,
    "resultKind" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readiness" "ReadinessLevel" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricsJson" JSONB,
    "sessionId" TEXT,

    CONSTRAINT "ProgressSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "subjectUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_isProtectedAccount_idx" ON "User"("isProtectedAccount");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplate_slug_key" ON "SessionTemplate"("slug");

-- CreateIndex
CREATE INDEX "SessionTemplate_published_sortOrder_idx" ON "SessionTemplate"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "SessionTemplateQuestion_templateId_idx" ON "SessionTemplateQuestion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplateQuestion_templateId_ordinal_key" ON "SessionTemplateQuestion"("templateId", "ordinal");

-- CreateIndex
CREATE INDEX "TrainingSession_userId_status_idx" ON "TrainingSession"("userId", "status");

-- CreateIndex
CREATE INDEX "TrainingSession_userId_createdAt_idx" ON "TrainingSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingSession_templateId_idx" ON "TrainingSession"("templateId");

-- CreateIndex
CREATE INDEX "TrainingSession_status_updatedAt_idx" ON "TrainingSession"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SessionResponse_sessionId_idx" ON "SessionResponse"("sessionId");

-- CreateIndex
CREATE INDEX "SessionResponse_templateQuestionId_idx" ON "SessionResponse"("templateQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionResponse_sessionId_templateQuestionId_key" ON "SessionResponse"("sessionId", "templateQuestionId");

-- CreateIndex
CREATE INDEX "SessionAnalysis_sessionId_createdAt_idx" ON "SessionAnalysis"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionAnalysis_status_idx" ON "SessionAnalysis"("status");

-- CreateIndex
CREATE INDEX "ProgressSnapshot_userId_capturedAt_idx" ON "ProgressSnapshot"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "ProgressSnapshot_sessionId_idx" ON "ProgressSnapshot"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_subjectUserId_idx" ON "AuditLog"("subjectUserId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateQuestion" ADD CONSTRAINT "SessionTemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionResponse" ADD CONSTRAINT "SessionResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionResponse" ADD CONSTRAINT "SessionResponse_templateQuestionId_fkey" FOREIGN KEY ("templateQuestionId") REFERENCES "SessionTemplateQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAnalysis" ADD CONSTRAINT "SessionAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshot" ADD CONSTRAINT "ProgressSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressSnapshot" ADD CONSTRAINT "ProgressSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
