ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "ticketsEmailDeliveredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ticketsEmailProviderId" TEXT,
ADD COLUMN IF NOT EXISTS "ticketsEmailStatus" TEXT,
ADD COLUMN IF NOT EXISTS "ticketsEmailLastCheckedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ticketsEmailLastError" TEXT,
ADD COLUMN IF NOT EXISTS "ticketsEmailAttempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "Order"
SET
  "ticketsEmailStatus" = 'accepted',
  "ticketsEmailAttempts" = GREATEST("ticketsEmailAttempts", 1),
  "ticketsEmailLastCheckedAt" = COALESCE("ticketsEmailLastCheckedAt", "ticketsEmailSentAt")
WHERE "ticketsEmailSentAt" IS NOT NULL
  AND "ticketsEmailStatus" IS NULL;

CREATE INDEX IF NOT EXISTS "Order_ticketsEmailProviderId_idx" ON "Order"("ticketsEmailProviderId");
