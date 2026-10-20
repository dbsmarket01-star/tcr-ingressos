-- The notification probe and conversation history are on the operator's hot path.
-- Build concurrently so existing WhatsApp writes remain available.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "whatsapp_log_org_status_created_idx"
ON "WhatsAppMessageLog" ("organizationId", "status", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "whatsapp_log_org_phone_created_idx"
ON "WhatsAppMessageLog" ("organizationId", "recipientPhone", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customer_phone_whatsapp_idx"
ON "Customer" ("phone");
