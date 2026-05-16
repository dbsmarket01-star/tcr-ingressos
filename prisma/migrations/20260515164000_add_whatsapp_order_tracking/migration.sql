ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "purchaseApprovedWhatsAppSentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cartAbandonmentSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_cartAbandonmentSentAt_idx" ON "Order"("cartAbandonmentSentAt");
