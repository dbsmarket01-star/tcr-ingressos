ALTER TABLE "Order"
ADD COLUMN "refundedInCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalPaymentId" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRefund_orderId_externalPaymentId_key"
ON "PaymentRefund"("orderId", "externalPaymentId");

CREATE INDEX "PaymentRefund_orderId_idx" ON "PaymentRefund"("orderId");

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Order"
SET "refundedInCents" = "totalInCents"
WHERE "status" = 'REFUNDED';

INSERT INTO "PaymentRefund" (
    "id", "orderId", "externalPaymentId", "amountInCents", "rawPayload", "createdAt", "updatedAt"
)
SELECT
    'refund_' || o."id",
    o."id",
    COALESCE(p."externalId", 'legacy_' || o."id"),
    o."totalInCents",
    p."rawPayload",
    COALESCE(o."canceledAt", o."updatedAt"),
    COALESCE(o."canceledAt", o."updatedAt")
FROM "Order" o
LEFT JOIN "Payment" p ON p."orderId" = o."id"
WHERE o."status" = 'REFUNDED'
ON CONFLICT ("orderId", "externalPaymentId") DO NOTHING;
