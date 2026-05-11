CREATE TYPE "HomeListStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED');

CREATE TABLE "Hotel" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "internalNotes" TEXT,
  "availableRooms" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TicketLot"
  ADD COLUMN "hotelId" TEXT,
  ADD COLUMN "hasHotel" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OrderHotelGuest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "guestIndex" INTEGER NOT NULL DEFAULT 1,
  "guest1Name" TEXT NOT NULL,
  "guest1Document" TEXT NOT NULL,
  "guest1BirthDate" TIMESTAMP(3) NOT NULL,
  "guest1Email" TEXT NOT NULL,
  "guest1Phone" TEXT NOT NULL,
  "guest2Name" TEXT NOT NULL,
  "guest2Document" TEXT NOT NULL,
  "guest2BirthDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderHotelGuest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeListEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "orderHotelGuestId" TEXT NOT NULL,
  "status" "HomeListStatus" NOT NULL DEFAULT 'CONFIRMED',
  "roomNumber" TEXT,
  "purchaseDate" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "guest1Name" TEXT NOT NULL,
  "guest1Document" TEXT NOT NULL,
  "guest1BirthDate" TIMESTAMP(3) NOT NULL,
  "guest1Email" TEXT NOT NULL,
  "guest1Phone" TEXT NOT NULL,
  "guest2Name" TEXT NOT NULL,
  "guest2Document" TEXT NOT NULL,
  "guest2BirthDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HomeListEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Hotel_organizationId_name_idx" ON "Hotel"("organizationId", "name");
CREATE INDEX "TicketLot_hotelId_idx" ON "TicketLot"("hotelId");
CREATE UNIQUE INDEX "OrderHotelGuest_orderItemId_guestIndex_key" ON "OrderHotelGuest"("orderItemId", "guestIndex");
CREATE INDEX "OrderHotelGuest_orderId_idx" ON "OrderHotelGuest"("orderId");
CREATE INDEX "OrderHotelGuest_hotelId_idx" ON "OrderHotelGuest"("hotelId");
CREATE UNIQUE INDEX "HomeListEntry_orderHotelGuestId_key" ON "HomeListEntry"("orderHotelGuestId");
CREATE INDEX "HomeListEntry_organizationId_eventId_idx" ON "HomeListEntry"("organizationId", "eventId");
CREATE INDEX "HomeListEntry_organizationId_hotelId_idx" ON "HomeListEntry"("organizationId", "hotelId");
CREATE INDEX "HomeListEntry_organizationId_status_idx" ON "HomeListEntry"("organizationId", "status");
CREATE INDEX "HomeListEntry_orderId_idx" ON "HomeListEntry"("orderId");

ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketLot" ADD CONSTRAINT "TicketLot_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderHotelGuest" ADD CONSTRAINT "OrderHotelGuest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderHotelGuest" ADD CONSTRAINT "OrderHotelGuest_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderHotelGuest" ADD CONSTRAINT "OrderHotelGuest_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "TicketLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderHotelGuest" ADD CONSTRAINT "OrderHotelGuest_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "TicketLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HomeListEntry" ADD CONSTRAINT "HomeListEntry_orderHotelGuestId_fkey"
  FOREIGN KEY ("orderHotelGuestId") REFERENCES "OrderHotelGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
