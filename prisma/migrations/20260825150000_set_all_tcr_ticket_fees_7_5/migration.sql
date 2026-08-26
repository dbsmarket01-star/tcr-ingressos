-- Taxa de bilheteria de 7,5% em todos os lotes da TCR, incluindo o padrão
-- editável para novos ingressos. Outras organizações não são alteradas.
-- Não altera juros de cartão, splits, preços nominais ou pedidos existentes.
BEGIN;

UPDATE "CompanySettings" cs
SET "platformFeeBps" = 750
FROM "Organization" o
WHERE cs."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos';

UPDATE "TicketLot" tl
SET "serviceFeeBps" = 750
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE tl."eventId" = e."id"
  AND o."slug" = 'tcr-ingressos';

COMMIT;
