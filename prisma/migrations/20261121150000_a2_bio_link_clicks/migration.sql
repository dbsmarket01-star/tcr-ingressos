CREATE TABLE "BioLinkClick" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaign" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BioLinkClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BioLinkClick_organizationId_campaign_createdAt_idx"
  ON "BioLinkClick"("organizationId", "campaign", "createdAt");

ALTER TABLE "BioLinkClick" ADD CONSTRAINT "BioLinkClick_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
