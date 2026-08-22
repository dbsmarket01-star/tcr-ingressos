-- A TCR volta a anunciar o valor nominal do ingresso e cobrar somente a taxa
-- de bilheteria configurada manualmente em cada lote. O A2 não é alterado.
UPDATE "CompanySettings" cs
SET "platformFeeBps" = 750,
    "pixTransactionFeeInCents" = 0
FROM "Organization" o
WHERE cs."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos';

-- A taxa padrão atual passa a ser 7,5%. Ela continua editável por lote no painel.
-- Pedidos e itens já criados guardam seus próprios valores e não são alterados.
UPDATE "TicketLot" tl
SET "serviceFeeBps" = 750
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE tl."eventId" = e."id"
  AND o."slug" = 'tcr-ingressos';

-- Diego e Pietro ficam desativados temporariamente. Lucas permanece ativo
-- com o valor fixo já configurado de R$ 1,50 por ingresso.
UPDATE "PaymentSplitRule" psr
SET "isActive" = FALSE
FROM "Organization" o
WHERE psr."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos'
  AND LOWER(psr."name") IN ('diego', 'pietro');
