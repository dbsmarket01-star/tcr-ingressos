DROP INDEX IF EXISTS "AdminUser_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_organizationId_email_key" ON "AdminUser"("organizationId", "email");
