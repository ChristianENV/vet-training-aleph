-- Idempotency and dedupe hardening for voice events/turns.

-- AlterTable
ALTER TABLE "SessionEvent" ADD COLUMN "clientEventId" TEXT;

-- AlterTable
ALTER TABLE "SessionTurn" ADD COLUMN "clientTurnId" TEXT;
ALTER TABLE "SessionTurn" ADD COLUMN "sourceClientEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_sessionId_clientEventId_key" ON "SessionEvent"("sessionId", "clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTurn_sessionId_clientTurnId_key" ON "SessionTurn"("sessionId", "clientTurnId");

-- CreateIndex
CREATE INDEX "SessionTurn_sessionId_sourceClientEventId_idx" ON "SessionTurn"("sessionId", "sourceClientEventId");

