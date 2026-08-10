CREATE TABLE "EmailAudience" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceFilename" TEXT,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailAudienceContact" (
    "id" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAudienceContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailAudience_organizationId_createdAt_idx" ON "EmailAudience"("organizationId", "createdAt");
CREATE UNIQUE INDEX "EmailAudienceContact_audienceId_email_key" ON "EmailAudienceContact"("audienceId", "email");
CREATE INDEX "EmailAudienceContact_email_idx" ON "EmailAudienceContact"("email");

ALTER TABLE "EmailAudience" ADD CONSTRAINT "EmailAudience_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAudienceContact" ADD CONSTRAINT "EmailAudienceContact_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "EmailAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
