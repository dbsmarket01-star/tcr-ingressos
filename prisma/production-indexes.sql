-- Indices operacionais para a TCR Ingressos em producao.
-- Rode no banco de producao quando quiser aplicar sem usar Prisma Migrate.

CREATE INDEX IF NOT EXISTS "Order_status_expiresAt_idx"
ON "Order" ("status", "expiresAt");

CREATE INDEX IF NOT EXISTS "Order_createdAt_idx"
ON "Order" ("createdAt");

CREATE INDEX IF NOT EXISTS "Payment_externalId_idx"
ON "Payment" ("externalId");

CREATE INDEX IF NOT EXISTS "Payment_status_updatedAt_idx"
ON "Payment" ("status", "updatedAt");
