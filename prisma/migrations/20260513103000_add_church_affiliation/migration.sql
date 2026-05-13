ALTER TABLE "TicketLot"
ADD COLUMN "churchQuestionEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
ADD COLUMN "churchName" TEXT;

CREATE INDEX "Order_eventId_churchName_idx" ON "Order"("eventId", "churchName");
