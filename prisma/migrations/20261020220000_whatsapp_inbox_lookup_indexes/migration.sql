CREATE INDEX CONCURRENTLY IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WhatsAppMessageLog_organizationId_status_createdAt_id_idx" ON "WhatsAppMessageLog"("organizationId", "status", "createdAt", "id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WhatsAppMessageLog_organizationId_recipientPhone_createdAt_idx" ON "WhatsAppMessageLog"("organizationId", "recipientPhone", "createdAt");
