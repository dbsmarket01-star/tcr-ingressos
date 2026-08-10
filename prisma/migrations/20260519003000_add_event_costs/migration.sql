CREATE TABLE "EventCost" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "supplierName" TEXT,
  "amountInCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventCost_eventId_idx" ON "EventCost"("eventId");
CREATE INDEX "EventCost_status_idx" ON "EventCost"("status");

ALTER TABLE "EventCost"
ADD CONSTRAINT "EventCost_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
