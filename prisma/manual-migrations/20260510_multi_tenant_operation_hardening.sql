-- Multi-tenant hardening support migration.
-- Run after the default/root organization exists, or let this script create a minimal one.

INSERT INTO "Organization" (
  "id",
  "slug",
  "name",
  "publicDomain",
  "adminDomain",
  "primaryColor",
  "secondaryColor",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'tcr-ingressos-default',
  'tcr-ingressos',
  'TCR Ingressos',
  'tcringressos.app.br',
  'produtor.tcringressos.app.br',
  '#0d5c63',
  '#ffffff',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

DO $$
DECLARE
  default_org_id TEXT;
BEGIN
  SELECT "id" INTO default_org_id
  FROM "Organization"
  WHERE "slug" = 'tcr-ingressos'
  LIMIT 1;

  UPDATE "AdminUser"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "Event"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "CompanySettings"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;

  UPDATE "PaymentSplitRule"
  SET "organizationId" = default_org_id
  WHERE "organizationId" IS NULL;
END $$;

ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "couponsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EventLead"
ADD COLUMN IF NOT EXISTS "emailOptOutAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_publicDomain_key"
ON "Organization" ("publicDomain");

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_adminDomain_key"
ON "Organization" ("adminDomain");

ALTER TABLE "AdminUser"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Event"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "CompanySettings"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "PaymentSplitRule"
ALTER COLUMN "organizationId" SET NOT NULL;
