-- A2 Imergidos vende pelo valor nominal do ingresso, sem taxa ao comprador.
-- A regra comercial de taxa fixa, cartão e arredondamento permanece exclusiva da TCR.
UPDATE "CompanySettings" cs
SET "platformFeeBps" = 0,
    "pixTransactionFeeInCents" = 0,
    "cardBaseFeeBps" = 0,
    "cardAdditionalInstallmentFeeBps" = 0
FROM "Organization" o
WHERE cs."organizationId" = o."id"
  AND o."slug" = 'a2-imergidos';

UPDATE "TicketLot" tl
SET "serviceFeeBps" = 0,
    "cardInterestBpsPerInstallment" = 0
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE tl."eventId" = e."id"
  AND o."slug" = 'a2-imergidos';

-- Corrige apenas reservas ainda não pagas. Vendas concluídas e relatórios históricos não mudam.
UPDATE "OrderItem" oi
SET "serviceFeeBps" = 0,
    "serviceFeeInCents" = 0,
    "cardInterestBpsPerInstallment" = 0
FROM "Order" ord
INNER JOIN "Event" e ON e."id" = ord."eventId"
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE oi."orderId" = ord."id"
  AND ord."status" = 'PENDING_PAYMENT'
  AND o."slug" = 'a2-imergidos';

UPDATE "Order" ord
SET "serviceFeeInCents" = 0,
    "cardInterestInCents" = 0,
    "totalInCents" = GREATEST(ord."subtotalInCents" - ord."discountInCents", 0)
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE ord."eventId" = e."id"
  AND ord."status" = 'PENDING_PAYMENT'
  AND o."slug" = 'a2-imergidos';

UPDATE "Payment" p
SET "amountInCents" = ord."totalInCents"
FROM "Order" ord
INNER JOIN "Event" e ON e."id" = ord."eventId"
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE p."orderId" = ord."id"
  AND ord."status" = 'PENDING_PAYMENT'
  AND o."slug" = 'a2-imergidos';
