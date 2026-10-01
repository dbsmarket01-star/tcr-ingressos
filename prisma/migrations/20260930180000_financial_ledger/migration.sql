-- CreateTable
CREATE TABLE "FinancialLedgerAccount" (
    "organizationId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "openingCashInCents" BIGINT NOT NULL,
    "openingProducerInCents" BIGINT NOT NULL,
    "openingReceivablesInCents" BIGINT NOT NULL,
    "openingEvidence" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerAccount_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountInCents" BIGINT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "externalPaymentId" TEXT,
    "transactionId" TEXT,
    "reversalOfId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialClosing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceHash" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "ledgerHash" TEXT NOT NULL,
    "ledgerSequence" BIGINT NOT NULL,
    "ledgerCount" INTEGER NOT NULL,
    "differenceInCents" BIGINT NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "details" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolutionEvidence" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_sequence_key" ON "FinancialLedgerEntry"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_reversalOfId_key" ON "FinancialLedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_organizationId_effectiveAt_sequence_idx" ON "FinancialLedgerEntry"("organizationId", "effectiveAt", "sequence");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_organizationId_orderId_type_idx" ON "FinancialLedgerEntry"("organizationId", "orderId", "type");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_organizationId_externalPaymentId_idx" ON "FinancialLedgerEntry"("organizationId", "externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_organizationId_sourceKey_key" ON "FinancialLedgerEntry"("organizationId", "sourceKey");

-- CreateIndex
CREATE INDEX "FinancialClosing_organizationId_date_status_idx" ON "FinancialClosing"("organizationId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialClosing_organizationId_date_revision_key" ON "FinancialClosing"("organizationId", "date", "revision");

-- CreateIndex
CREATE INDEX "FinancialIncident_organizationId_resolvedAt_effectiveAt_idx" ON "FinancialIncident"("organizationId", "resolvedAt", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialIncident_organizationId_key_key" ON "FinancialIncident"("organizationId", "key");

-- CreateIndex
CREATE INDEX "FinancialLedgerAudit_organizationId_createdAt_idx" ON "FinancialLedgerAudit"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FinancialLedgerAccount"("organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FinancialLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialClosing" ADD CONSTRAINT "FinancialClosing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FinancialLedgerAccount"("organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialIncident" ADD CONSTRAINT "FinancialIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FinancialLedgerAccount"("organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerAudit" ADD CONSTRAINT "FinancialLedgerAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "FinancialLedgerAccount"("organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "FinancialLedgerAccount" ADD CONSTRAINT "LedgerAccount_organization_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "LedgerEntry_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "LedgerEntry_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "LedgerEntry_positive" CHECK ("amountInCents" > 0 AND "amountInCents" <= 9007199254740991);
ALTER TABLE "FinancialClosing" ADD CONSTRAINT "Closing_state" CHECK (status IN ('DRAFT','BLOCKED','RECONCILED','PUBLISHED'));
ALTER TABLE "FinancialClosing" ADD CONSTRAINT "Closing_zero_difference" CHECK (status NOT IN ('RECONCILED','PUBLISHED') OR ("differenceInCents"=0 AND "issueCount"=0));
CREATE FUNCTION financial_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Financial history is append-only' USING ERRCODE='23514'; END; $$;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON "FinancialLedgerEntry" FOR EACH ROW EXECUTE FUNCTION financial_immutable();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "FinancialLedgerAudit" FOR EACH ROW EXECUTE FUNCTION financial_immutable();
CREATE TRIGGER account_immutable BEFORE UPDATE OR DELETE ON "FinancialLedgerAccount" FOR EACH ROW EXECUTE FUNCTION financial_immutable();
CREATE FUNCTION financial_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_account text; expected_direction text; original "FinancialLedgerEntry"%ROWTYPE; org text;
BEGIN
  PERFORM 1 FROM "FinancialLedgerAccount" WHERE "organizationId"=NEW."organizationId" FOR UPDATE;
  IF NEW.type='REVERSAL' THEN
    SELECT * INTO STRICT original FROM "FinancialLedgerEntry" WHERE id=NEW."reversalOfId" AND "organizationId"=NEW."organizationId";
    IF original.type='REVERSAL' OR original."amountInCents"<>NEW."amountInCents" OR original."effectiveAt"<>NEW."effectiveAt" THEN RAISE EXCEPTION 'Invalid reversal'; END IF;
    expected_account := original.account;
    expected_direction := CASE WHEN original.direction='CREDIT' THEN 'DEBIT' ELSE 'CREDIT' END;
  ELSE
    IF NEW."reversalOfId" IS NOT NULL THEN RAISE EXCEPTION 'Unexpected reversal link'; END IF;
    CASE NEW.type
    WHEN 'SALE_PRINCIPAL' THEN expected_account := 'PRODUCER'; expected_direction := 'CREDIT';
    WHEN 'SERVICE_FEE' THEN expected_account := 'FEES'; expected_direction := 'CREDIT';
    WHEN 'CARD_INTEREST' THEN expected_account := 'INTEREST'; expected_direction := 'CREDIT';
    WHEN 'REFUND_PRINCIPAL' THEN expected_account := 'PRODUCER'; expected_direction := 'DEBIT';
    WHEN 'REFUND_FEE' THEN expected_account := 'FEES'; expected_direction := 'DEBIT';
    WHEN 'REFUND_INTEREST' THEN expected_account := 'INTEREST'; expected_direction := 'DEBIT';
    WHEN 'BILHETERIA_WITHDRAWAL' THEN expected_account := 'ALLOCATION'; expected_direction := 'DEBIT';
    WHEN 'PRODUCER_WITHDRAWAL' THEN expected_account := 'PRODUCER'; expected_direction := 'DEBIT';
    WHEN 'ASAAS_FEE' THEN expected_account := 'COSTS'; expected_direction := 'DEBIT';
    WHEN 'ASAAS_FEE_REVERSAL' THEN expected_account := 'COSTS'; expected_direction := 'CREDIT';
    WHEN 'SPLIT' THEN expected_account := 'SPLITS'; expected_direction := 'DEBIT';
    WHEN 'SPLIT_REVERSAL' THEN expected_account := 'SPLITS'; expected_direction := 'CREDIT';
    WHEN 'RECEIVABLE_OPEN' THEN expected_account := 'RECEIVABLES'; expected_direction := 'CREDIT';
    WHEN 'RECEIVABLE_SETTLED' THEN expected_account := 'RECEIVABLES'; expected_direction := 'DEBIT';
    WHEN 'RECEIVABLE_REFUND' THEN expected_account := 'RECEIVABLES'; expected_direction := 'DEBIT';
    WHEN 'CASH_RECEIPT' THEN expected_account := 'CASH'; expected_direction := 'CREDIT';
    WHEN 'CASH_REFUND' THEN expected_account := 'CASH'; expected_direction := 'DEBIT';
    WHEN 'CASH_WITHDRAWAL' THEN expected_account := 'CASH'; expected_direction := 'DEBIT';
    WHEN 'CASH_FEE' THEN expected_account := 'CASH'; expected_direction := 'DEBIT';
    WHEN 'CASH_FEE_REVERSAL' THEN expected_account := 'CASH'; expected_direction := 'CREDIT';
    WHEN 'CASH_SPLIT' THEN expected_account := 'CASH'; expected_direction := 'DEBIT';
    WHEN 'CASH_SPLIT_REVERSAL' THEN expected_account := 'CASH'; expected_direction := 'CREDIT';
    WHEN 'CASH_ANTICIPATION_SETTLEMENT' THEN expected_account := 'CASH'; expected_direction := 'DEBIT';
    WHEN 'CASH_TRANSFER_REVERSAL' THEN expected_account := 'CASH'; expected_direction := 'CREDIT';
    ELSE RAISE EXCEPTION 'Unknown economic type'; END CASE;
  END IF;
  IF NEW.account<>expected_account OR NEW.direction<>expected_direction THEN RAISE EXCEPTION 'Direction/account must be derived from type' USING ERRCODE='23514'; END IF;
  IF NEW."orderId" IS NOT NULL THEN
    SELECT e."organizationId" INTO org FROM "Order" o JOIN "Event" e ON e.id=o."eventId" WHERE o.id=NEW."orderId";
    IF org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'Ledger tenant mismatch'; END IF;
  END IF;
  IF NEW."paymentId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Payment" p WHERE p.id=NEW."paymentId" AND p."orderId"=NEW."orderId") THEN RAISE EXCEPTION 'Ledger payment mismatch'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER ledger_entry_guard BEFORE INSERT ON "FinancialLedgerEntry" FOR EACH ROW EXECUTE FUNCTION financial_entry_guard();
CREATE FUNCTION financial_late_entry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF EXISTS(SELECT 1 FROM "FinancialClosing" WHERE "organizationId"=NEW."organizationId" AND status='PUBLISHED' AND date >= (NEW."effectiveAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date) THEN
    INSERT INTO "FinancialIncident" (id,"organizationId",key,kind,"effectiveAt",details,"createdAt") VALUES ('late-'||NEW.id,NEW."organizationId",'late:'||NEW.id,'LATE_ENTRY_AFTER_PUBLICATION',NEW."effectiveAt",jsonb_build_object('entryId',NEW.id),now()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER ledger_late_entry AFTER INSERT ON "FinancialLedgerEntry" FOR EACH ROW EXECUTE FUNCTION financial_late_entry();
CREATE FUNCTION financial_closing_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last_sequence bigint; n integer;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Closing history cannot be deleted'; END IF;
  PERFORM 1 FROM "FinancialLedgerAccount" WHERE "organizationId"=NEW."organizationId" FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'DRAFT' OR NEW."publishedAt" IS NOT NULL OR NEW."publishedBy" IS NOT NULL THEN RAISE EXCEPTION 'New closing must be DRAFT'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='DRAFT' AND (to_jsonb(NEW)-'status'-'result'-'differenceInCents'-'issueCount') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'result'-'differenceInCents'-'issueCount') THEN RAISE EXCEPTION 'Draft source snapshot is immutable'; END IF;
  IF OLD.status='PUBLISHED' THEN RAISE EXCEPTION 'Published closing is immutable'; END IF;
  IF OLD.status<>'DRAFT' AND (to_jsonb(NEW)-'status'-'publishedAt'-'publishedBy') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'publishedAt'-'publishedBy') THEN RAISE EXCEPTION 'Reconciliation snapshot is immutable'; END IF;
  IF NEW.status='PUBLISHED' THEN
    IF OLD.status<>'RECONCILED' OR NEW."publishedBy" IS NULL OR NEW."publishedAt" IS NULL THEN RAISE EXCEPTION 'Reconciled closing required'; END IF;
    SELECT COALESCE(max(sequence),0),count(*) INTO last_sequence,n FROM "FinancialLedgerEntry" WHERE "organizationId"=NEW."organizationId" AND "effectiveAt"<(((NEW.date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC');
    IF last_sequence<>NEW."ledgerSequence" OR n<>NEW."ledgerCount" OR EXISTS(SELECT 1 FROM "FinancialIncident" WHERE "organizationId"=NEW."organizationId" AND "resolvedAt" IS NULL AND "effectiveAt"<(((NEW.date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')) THEN RAISE EXCEPTION 'Stale or blocked financial closing'; END IF;
  ELSIF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'Invalid closing transition'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER closing_guard BEFORE INSERT OR UPDATE OR DELETE ON "FinancialClosing" FOR EACH ROW EXECUTE FUNCTION financial_closing_guard();

-- TRUNCATE does not fire row DELETE triggers; protect that path explicitly.
CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON "FinancialLedgerEntry" FOR EACH STATEMENT EXECUTE FUNCTION financial_immutable();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON "FinancialLedgerAudit" FOR EACH STATEMENT EXECUTE FUNCTION financial_immutable();
CREATE TRIGGER account_no_truncate BEFORE TRUNCATE ON "FinancialLedgerAccount" FOR EACH STATEMENT EXECUTE FUNCTION financial_immutable();
CREATE TRIGGER closing_no_truncate BEFORE TRUNCATE ON "FinancialClosing" FOR EACH STATEMENT EXECUTE FUNCTION financial_immutable();
ALTER TABLE "FinancialClosing" ADD CONSTRAINT "Closing_valid_counts" CHECK (revision > 0 AND "ledgerCount" >= 0 AND "ledgerSequence" >= 0 AND "issueCount" >= 0 AND "differenceInCents" >= 0);
