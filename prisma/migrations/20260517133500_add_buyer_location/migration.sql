ALTER TABLE "Customer"
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "postalCode" TEXT;

ALTER TABLE "Order"
ADD COLUMN "buyerCity" TEXT,
ADD COLUMN "buyerState" TEXT,
ADD COLUMN "buyerPostalCode" TEXT;

CREATE INDEX "Customer_city_state_idx" ON "Customer"("city", "state");
CREATE INDEX "Order_buyerCity_buyerState_idx" ON "Order"("buyerCity", "buyerState");
