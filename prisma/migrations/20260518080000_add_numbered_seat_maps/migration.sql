CREATE TYPE "SeatMapKind" AS ENUM ('THEATER', 'ARENA', 'OVAL', 'RESTAURANT', 'CUSTOM');
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED', 'ACCESSIBLE');
CREATE TYPE "SeatTableShape" AS ENUM ('ROUND', 'SQUARE', 'RECTANGLE');

CREATE TABLE "SeatMap" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "SeatMapKind" NOT NULL DEFAULT 'CUSTOM',
  "width" INTEGER NOT NULL DEFAULT 1200,
  "height" INTEGER NOT NULL DEFAULT 800,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "backgroundImageUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeatMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeatSection" (
  "id" TEXT NOT NULL,
  "seatMapId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "ticketLotId" TEXT,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#d4a017',
  "priceInCents" INTEGER,
  "description" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "x" INTEGER NOT NULL DEFAULT 0,
  "y" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER NOT NULL DEFAULT 300,
  "height" INTEGER NOT NULL DEFAULT 180,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeatSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Seat" (
  "id" TEXT NOT NULL,
  "seatMapId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "ticketLotId" TEXT,
  "publicCode" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "rowLabel" TEXT,
  "seatNumber" TEXT NOT NULL,
  "tableId" TEXT,
  "tableLabel" TEXT,
  "tableShape" "SeatTableShape",
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "radius" INTEGER NOT NULL DEFAULT 9,
  "priceInCents" INTEGER,
  "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
  "isAccessible" BOOLEAN NOT NULL DEFAULT false,
  "blockedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeatReservation" (
  "id" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeatReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderSeat" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "priceInCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderSeat_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Ticket" ADD COLUMN "seatId" TEXT;

CREATE INDEX "SeatMap_eventId_isActive_idx" ON "SeatMap"("eventId", "isActive");
CREATE INDEX "SeatSection_seatMapId_priority_idx" ON "SeatSection"("seatMapId", "priority");
CREATE INDEX "SeatSection_eventId_idx" ON "SeatSection"("eventId");
CREATE INDEX "SeatSection_ticketLotId_idx" ON "SeatSection"("ticketLotId");
CREATE UNIQUE INDEX "Seat_eventId_publicCode_key" ON "Seat"("eventId", "publicCode");
CREATE INDEX "Seat_seatMapId_status_idx" ON "Seat"("seatMapId", "status");
CREATE INDEX "Seat_sectionId_status_idx" ON "Seat"("sectionId", "status");
CREATE INDEX "Seat_ticketLotId_idx" ON "Seat"("ticketLotId");
CREATE UNIQUE INDEX "SeatReservation_seatId_orderId_key" ON "SeatReservation"("seatId", "orderId");
CREATE INDEX "SeatReservation_orderId_idx" ON "SeatReservation"("orderId");
CREATE INDEX "SeatReservation_orderItemId_idx" ON "SeatReservation"("orderItemId");
CREATE INDEX "SeatReservation_expiresAt_releasedAt_idx" ON "SeatReservation"("expiresAt", "releasedAt");
CREATE UNIQUE INDEX "OrderSeat_seatId_key" ON "OrderSeat"("seatId");
CREATE INDEX "OrderSeat_orderId_idx" ON "OrderSeat"("orderId");
CREATE INDEX "OrderSeat_orderItemId_idx" ON "OrderSeat"("orderItemId");
CREATE INDEX "Ticket_seatId_idx" ON "Ticket"("seatId");

ALTER TABLE "SeatMap" ADD CONSTRAINT "SeatMap_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatSection" ADD CONSTRAINT "SeatSection_seatMapId_fkey" FOREIGN KEY ("seatMapId") REFERENCES "SeatMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatSection" ADD CONSTRAINT "SeatSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatSection" ADD CONSTRAINT "SeatSection_ticketLotId_fkey" FOREIGN KEY ("ticketLotId") REFERENCES "TicketLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_seatMapId_fkey" FOREIGN KEY ("seatMapId") REFERENCES "SeatMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SeatSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_ticketLotId_fkey" FOREIGN KEY ("ticketLotId") REFERENCES "TicketLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeatReservation" ADD CONSTRAINT "SeatReservation_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatReservation" ADD CONSTRAINT "SeatReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatReservation" ADD CONSTRAINT "SeatReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderSeat" ADD CONSTRAINT "OrderSeat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderSeat" ADD CONSTRAINT "OrderSeat_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderSeat" ADD CONSTRAINT "OrderSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
