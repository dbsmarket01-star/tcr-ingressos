CREATE TABLE IF NOT EXISTS "ResendWebhookEvent" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerCreatedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "processingAttempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResendWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResendWebhookEvent_dedupeKey_key" ON "ResendWebhookEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "ResendWebhookEvent_providerMessageId_eventType_idx" ON "ResendWebhookEvent"("providerMessageId", "eventType");
CREATE INDEX IF NOT EXISTS "ResendWebhookEvent_status_createdAt_idx" ON "ResendWebhookEvent"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ResendWebhookEvent_processedAt_idx" ON "ResendWebhookEvent"("processedAt");
