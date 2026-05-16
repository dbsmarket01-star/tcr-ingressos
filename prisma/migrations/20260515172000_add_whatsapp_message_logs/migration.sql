DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageType" AS ENUM ('PURCHASE_APPROVED', 'CART_ABANDONMENT', 'BULK', 'WEBHOOK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppMessageLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "eventId" TEXT,
  "orderId" TEXT,
  "leadId" TEXT,
  "type" "WhatsAppMessageType" NOT NULL,
  "status" "WhatsAppMessageStatus" NOT NULL,
  "templateName" TEXT,
  "recipientName" TEXT,
  "recipientPhone" TEXT,
  "providerMessageId" TEXT,
  "errorMessage" TEXT,
  "payload" JSONB,
  "webhookPayload" JSONB,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhatsAppMessageLog_organizationId_createdAt_idx" ON "WhatsAppMessageLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessageLog_eventId_createdAt_idx" ON "WhatsAppMessageLog"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessageLog_orderId_idx" ON "WhatsAppMessageLog"("orderId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessageLog_leadId_idx" ON "WhatsAppMessageLog"("leadId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessageLog_providerMessageId_idx" ON "WhatsAppMessageLog"("providerMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessageLog_status_createdAt_idx" ON "WhatsAppMessageLog"("status", "createdAt");
