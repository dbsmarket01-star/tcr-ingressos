-- CreateEnum
CREATE TYPE "TicketLotOptionStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- AlterTable
ALTER TABLE "TicketLot" ADD COLUMN "hasTypeOptions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "lotOptionId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "lotOptionId" TEXT;

-- CreateTable
CREATE TABLE "TicketLotOption" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "TicketLotOptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketLotOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketLotOption_lotId_label_key" ON "TicketLotOption"("lotId", "label");

-- CreateIndex
CREATE INDEX "TicketLotOption_lotId_status_sortOrder_idx" ON "TicketLotOption"("lotId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "OrderItem_lotOptionId_idx" ON "OrderItem"("lotOptionId");

-- CreateIndex
CREATE INDEX "Ticket_lotOptionId_idx" ON "Ticket"("lotOptionId");

-- AddForeignKey
ALTER TABLE "TicketLotOption" ADD CONSTRAINT "TicketLotOption_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "TicketLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_lotOptionId_fkey" FOREIGN KEY ("lotOptionId") REFERENCES "TicketLotOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_lotOptionId_fkey" FOREIGN KEY ("lotOptionId") REFERENCES "TicketLotOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
