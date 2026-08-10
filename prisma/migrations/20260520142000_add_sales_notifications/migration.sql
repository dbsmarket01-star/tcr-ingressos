-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "salesNotificationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salesNotificationEmails" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "salesNotificationSentAt" TIMESTAMP(3);
