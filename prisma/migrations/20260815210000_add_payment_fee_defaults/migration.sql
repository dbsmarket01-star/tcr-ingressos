ALTER TABLE "CompanySettings"
ADD COLUMN "pixTransactionFeeInCents" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN "cardBaseFeeBps" INTEGER NOT NULL DEFAULT 400,
ADD COLUMN "cardAdditionalInstallmentFeeBps" INTEGER NOT NULL DEFAULT 300;

-- Novas reservas dos ingressos existentes passam a usar a taxa-base dos splits.
-- Pedidos e itens historicos guardam seus proprios valores e nao sao alterados.
UPDATE "TicketLot"
SET "serviceFeeBps" = 1750
WHERE "eventId" IN (
  SELECT e."id"
  FROM "Event" e
  INNER JOIN "Organization" o ON o."id" = e."organizationId"
  WHERE o."slug" = 'tcr-ingressos'
);

UPDATE "CompanySettings" cs
SET "platformFeeBps" = 1750,
    "pixTransactionFeeInCents" = 200,
    "cardBaseFeeBps" = 400,
    "cardAdditionalInstallmentFeeBps" = 300
FROM "Organization" o
WHERE cs."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos';
