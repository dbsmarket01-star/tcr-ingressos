-- CreateTable
CREATE TABLE "WaIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "portfolioId" TEXT,
    "health" JSONB NOT NULL DEFAULT '{}',
    "syncedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "blockedUntil" TIMESTAMP(3),
    "frequencyHours" INTEGER NOT NULL DEFAULT 72,
    "cooldownDays" INTEGER NOT NULL DEFAULT 14,
    "disengagedAfter" INTEGER NOT NULL DEFAULT 3,
    "minimumIntervalMs" INTEGER NOT NULL DEFAULT 1000,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaContact" (
    "lastReservedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "tag" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "optInStatus" TEXT NOT NULL DEFAULT 'unknown',
    "optInDate" TIMESTAMP(3),
    "optInSource" TEXT,
    "purpose" TEXT NOT NULL DEFAULT '',
    "collectionSource" TEXT NOT NULL DEFAULT '',
    "lastInboundAt" TIMESTAMP(3),
    "lastMarketingAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "unengagedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaSuppression" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaContactList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "source" TEXT NOT NULL,
    "originalCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "importDetails" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaContactList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "WaListMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quality" TEXT,
    "components" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creationKey" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nova campanha',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL DEFAULT '{}',
    "snapshot" JSONB,
    "snapshotHash" TEXT,
    "listId" TEXT,
    "templateId" TEXT,
    "phoneNumberId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "nextDispatchAt" TIMESTAMP(3),
    "dispatchedCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaMedia" (
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "uploadVersion" INTEGER NOT NULL DEFAULT 0,
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaMessageJob" (
    "reservedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "recipient" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attemptId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchStartedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "clickToken" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaMessageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaMessageEvent" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "jobId" TEXT,
    "organizationId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "phone" TEXT,
    "kind" TEXT NOT NULL,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaMessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaRateGate" (
    "key" TEXT NOT NULL,
    "nextAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "WaRateGate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WaAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaIntegration_organizationId_key" ON "WaIntegration"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WaIntegration_phoneNumberId_key" ON "WaIntegration"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "WaContact_organizationId_phone_key" ON "WaContact"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "WaSuppression_organizationId_phone_key" ON "WaSuppression"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "WaListMember_listId_contactId_key" ON "WaListMember"("listId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "WaTemplate_organizationId_metaId_key" ON "WaTemplate"("organizationId", "metaId");

-- CreateIndex
CREATE UNIQUE INDEX "WaTemplate_organizationId_name_language_key" ON "WaTemplate"("organizationId", "name", "language");

-- CreateIndex
CREATE INDEX "WaCampaign_status_nextDispatchAt_idx" ON "WaCampaign"("status", "nextDispatchAt");

-- CreateIndex
CREATE INDEX "WaCampaign_organizationId_createdAt_idx" ON "WaCampaign"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaCampaign_organizationId_creationKey_key" ON "WaCampaign"("organizationId", "creationKey");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageJob_attemptId_key" ON "WaMessageJob"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageJob_providerMessageId_key" ON "WaMessageJob"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageJob_clickToken_key" ON "WaMessageJob"("clickToken");

-- CreateIndex
CREATE INDEX "WaMessageJob_state_availableAt_idx" ON "WaMessageJob"("state", "availableAt");

-- CreateIndex
CREATE INDEX "WaMessageJob_organizationId_phone_createdAt_idx" ON "WaMessageJob"("organizationId", "phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageJob_campaignId_contactId_key" ON "WaMessageJob"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageJob_campaignId_phone_key" ON "WaMessageJob"("campaignId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "WaMessageEvent_sourceKey_key" ON "WaMessageEvent"("sourceKey");

-- CreateIndex
CREATE INDEX "WaAudit_organizationId_campaignId_createdAt_idx" ON "WaAudit"("organizationId", "campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "WaListMember" ADD CONSTRAINT "WaListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "WaContactList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaListMember" ADD CONSTRAINT "WaListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WaContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaMessageJob" ADD CONSTRAINT "WaMessageJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WaCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaMessageJob" ADD CONSTRAINT "WaMessageJob_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "WaContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaMessageEvent" ADD CONSTRAINT "WaMessageEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "WaMessageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Database-level safety remains effective across multiple workers and application restarts.
ALTER TABLE "WaCampaign" ADD CONSTRAINT "WaCampaign_status" CHECK (status IN ('draft','scheduled','queued','sending','paused','completed','failed','cancelled'));
ALTER TABLE "WaMessageJob" ADD CONSTRAINT "WaMessageJob_state" CHECK (state IN ('queued','sending','sent','delivered','read','failed','deferred','cancelled'));
ALTER TABLE "WaContact" ADD CONSTRAINT "WaContact_optin" CHECK ("optInStatus" IN ('unknown','opt_in','opt_out'));
CREATE FUNCTION wa_campaign_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Campaign history cannot be deleted'; END IF;
 IF OLD."confirmedAt" IS NOT NULL AND (NEW.config IS DISTINCT FROM OLD.config OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW."snapshotHash" IS DISTINCT FROM OLD."snapshotHash" OR NEW."organizationId"<>OLD."organizationId" OR NEW."listId" IS DISTINCT FROM OLD."listId" OR NEW."templateId" IS DISTINCT FROM OLD."templateId" OR NEW."phoneNumberId" IS DISTINCT FROM OLD."phoneNumberId" OR NEW."scheduledAt" IS DISTINCT FROM OLD."scheduledAt" OR NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt" OR NEW."confirmedBy" IS DISTINCT FROM OLD."confirmedBy") THEN RAISE EXCEPTION 'Confirmed campaign snapshot is immutable'; END IF;
 IF NEW.status<>'draft' AND (NEW.snapshot IS NULL OR NEW."confirmedAt" IS NULL OR NEW."snapshotHash" IS NULL) THEN RAISE EXCEPTION 'A confirmed snapshot is required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER wa_campaign_guard BEFORE UPDATE OR DELETE ON "WaCampaign" FOR EACH ROW EXECUTE FUNCTION wa_campaign_guard();
CREATE FUNCTION wa_job_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Recipient history cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (NEW."campaignId"<>OLD."campaignId" OR NEW."contactId"<>OLD."contactId" OR NEW."organizationId"<>OLD."organizationId" OR NEW.phone<>OLD.phone OR NEW.recipient IS DISTINCT FROM OLD.recipient OR NEW."clickToken"<>OLD."clickToken") THEN RAISE EXCEPTION 'Recipient snapshot is immutable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "WaCampaign" c JOIN "WaContact" p ON p.id=NEW."contactId" WHERE c.id=NEW."campaignId" AND c."organizationId"=NEW."organizationId" AND p."organizationId"=NEW."organizationId" AND p.phone=NEW.phone) THEN RAISE EXCEPTION 'Campaign recipient tenant mismatch'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER wa_job_guard BEFORE INSERT OR UPDATE OR DELETE ON "WaMessageJob" FOR EACH ROW EXECUTE FUNCTION wa_job_guard();
CREATE FUNCTION wa_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'WhatsApp audit is append-only'; END; $$;
CREATE TRIGGER wa_audit_guard BEFORE UPDATE OR DELETE ON "WaAudit" FOR EACH ROW EXECUTE FUNCTION wa_history_guard();
CREATE TRIGGER wa_audit_truncate BEFORE TRUNCATE ON "WaAudit" FOR EACH STATEMENT EXECUTE FUNCTION wa_history_guard();
CREATE FUNCTION wa_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.ready AND (NEW.data IS DISTINCT FROM OLD.data OR NEW.sha256<>OLD.sha256 OR NEW.metadata IS DISTINCT FROM OLD.metadata OR NEW."organizationId"<>OLD."organizationId" OR NOT NEW.ready) THEN RAISE EXCEPTION 'Validated media is immutable'; END IF;RETURN NEW;
END; $$;
CREATE TRIGGER wa_media_guard BEFORE UPDATE ON "WaMedia" FOR EACH ROW EXECUTE FUNCTION wa_media_guard();
