CREATE TYPE "MarketingEmailCampaignStatus" AS ENUM (
  'DRAFT',
  'READY',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED'
);

CREATE TYPE "MarketingEmailRecipientStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'UNSUBSCRIBED'
);

CREATE TABLE "MarketingEmailCampaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT,
  "imageUrl" TEXT,
  "ctaLabel" TEXT,
  "destinationUrl" TEXT,
  "status" "MarketingEmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "importTotalRows" INTEGER NOT NULL DEFAULT 0,
  "importRecognized" INTEGER NOT NULL DEFAULT 0,
  "importIgnored" INTEGER NOT NULL DEFAULT 0,
  "importInvalidEmails" INTEGER NOT NULL DEFAULT 0,
  "importDuplicates" INTEGER NOT NULL DEFAULT 0,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "processingStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingEmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingEmailRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "status" "MarketingEmailRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "emailOptOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingEmailRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingEmailCampaignClick" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEmailCampaignClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingEmailCampaignOpen" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEmailCampaignOpen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingEmailCampaign_organizationId_createdAt_idx" ON "MarketingEmailCampaign"("organizationId", "createdAt");
CREATE INDEX "MarketingEmailCampaign_organizationId_status_createdAt_idx" ON "MarketingEmailCampaign"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "MarketingEmailRecipient_campaignId_email_key" ON "MarketingEmailRecipient"("campaignId", "email");
CREATE INDEX "MarketingEmailRecipient_campaignId_status_createdAt_idx" ON "MarketingEmailRecipient"("campaignId", "status", "createdAt");
CREATE INDEX "MarketingEmailRecipient_email_idx" ON "MarketingEmailRecipient"("email");
CREATE INDEX "MarketingEmailRecipient_providerMessageId_idx" ON "MarketingEmailRecipient"("providerMessageId");
CREATE UNIQUE INDEX "MarketingEmailCampaignClick_campaignId_recipientId_key" ON "MarketingEmailCampaignClick"("campaignId", "recipientId");
CREATE INDEX "MarketingEmailCampaignClick_campaignId_createdAt_idx" ON "MarketingEmailCampaignClick"("campaignId", "createdAt");
CREATE INDEX "MarketingEmailCampaignClick_recipientId_idx" ON "MarketingEmailCampaignClick"("recipientId");
CREATE UNIQUE INDEX "MarketingEmailCampaignOpen_campaignId_recipientId_key" ON "MarketingEmailCampaignOpen"("campaignId", "recipientId");
CREATE INDEX "MarketingEmailCampaignOpen_campaignId_createdAt_idx" ON "MarketingEmailCampaignOpen"("campaignId", "createdAt");
CREATE INDEX "MarketingEmailCampaignOpen_recipientId_idx" ON "MarketingEmailCampaignOpen"("recipientId");

ALTER TABLE "MarketingEmailCampaign"
  ADD CONSTRAINT "MarketingEmailCampaign_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailRecipient"
  ADD CONSTRAINT "MarketingEmailRecipient_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "MarketingEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailCampaignClick"
  ADD CONSTRAINT "MarketingEmailCampaignClick_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "MarketingEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailCampaignClick"
  ADD CONSTRAINT "MarketingEmailCampaignClick_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "MarketingEmailRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailCampaignOpen"
  ADD CONSTRAINT "MarketingEmailCampaignOpen_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "MarketingEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailCampaignOpen"
  ADD CONSTRAINT "MarketingEmailCampaignOpen_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "MarketingEmailRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
