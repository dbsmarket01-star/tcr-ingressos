CREATE TABLE "WhatsAppSupportKnowledge" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventId" TEXT,
  "topic" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sourceMessageId" TEXT,
  "sourceAdminId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppSupportKnowledge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsAppSupportKnowledge_sourceMessageId_key" ON "WhatsAppSupportKnowledge"("sourceMessageId");
CREATE INDEX "WhatsAppSupportKnowledge_organizationId_status_eventId_idx" ON "WhatsAppSupportKnowledge"("organizationId", "status", "eventId");
CREATE INDEX "WhatsAppSupportKnowledge_organizationId_createdAt_idx" ON "WhatsAppSupportKnowledge"("organizationId", "createdAt");
