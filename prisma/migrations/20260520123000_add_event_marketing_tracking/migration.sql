-- CreateEnum
CREATE TYPE "MarketingTrackingEventType" AS ENUM ('PAGE_VIEW', 'VIEW_CONTENT', 'ADD_TO_CART', 'INITIATE_CHECKOUT', 'ORDER_CREATED', 'PURCHASE', 'CART_ABANDONED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "trackingLinkId" TEXT;

-- CreateTable
CREATE TABLE "EventTrackingLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingTrackingEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "trackingLinkId" TEXT,
    "orderId" TEXT,
    "eventType" "MarketingTrackingEventType" NOT NULL,
    "sessionKey" TEXT,
    "eventIdForMeta" TEXT,
    "valueInCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrer" TEXT,
    "landingPage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventTrackingLink_eventId_slug_key" ON "EventTrackingLink"("eventId", "slug");

-- CreateIndex
CREATE INDEX "EventTrackingLink_eventId_isActive_idx" ON "EventTrackingLink"("eventId", "isActive");

-- CreateIndex
CREATE INDEX "MarketingTrackingEvent_eventId_eventType_createdAt_idx" ON "MarketingTrackingEvent"("eventId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingTrackingEvent_trackingLinkId_eventType_createdAt_idx" ON "MarketingTrackingEvent"("trackingLinkId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingTrackingEvent_orderId_idx" ON "MarketingTrackingEvent"("orderId");

-- CreateIndex
CREATE INDEX "MarketingTrackingEvent_sessionKey_createdAt_idx" ON "MarketingTrackingEvent"("sessionKey", "createdAt");

-- CreateIndex
CREATE INDEX "Order_trackingLinkId_idx" ON "Order"("trackingLinkId");

-- AddForeignKey
ALTER TABLE "EventTrackingLink" ADD CONSTRAINT "EventTrackingLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTrackingEvent" ADD CONSTRAINT "MarketingTrackingEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTrackingEvent" ADD CONSTRAINT "MarketingTrackingEvent_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "EventTrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTrackingEvent" ADD CONSTRAINT "MarketingTrackingEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "EventTrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
