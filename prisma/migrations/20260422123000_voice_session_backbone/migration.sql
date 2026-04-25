-- Voice session conversational backbone persistence.

-- CreateTable
CREATE TABLE "SessionTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" JSONB,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAudioAsset" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "storageKey" TEXT,
    "provider" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "durationSec" INTEGER,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionAudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionTurn_sessionId_sequence_key" ON "SessionTurn"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "SessionTurn_sessionId_createdAt_idx" ON "SessionTurn"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_sessionId_sequence_key" ON "SessionEvent"("sessionId", "sequence");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_createdAt_idx" ON "SessionEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_type_idx" ON "SessionEvent"("sessionId", "type");

-- CreateIndex
CREATE INDEX "SessionAudioAsset_sessionId_createdAt_idx" ON "SessionAudioAsset"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "SessionTurn" ADD CONSTRAINT "SessionTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAudioAsset" ADD CONSTRAINT "SessionAudioAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

