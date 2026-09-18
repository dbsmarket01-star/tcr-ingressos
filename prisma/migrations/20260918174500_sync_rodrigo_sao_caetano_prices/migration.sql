UPDATE "TicketLot" AS lot
SET "priceInCents" = CASE lot."name"
  WHEN 'PISTA - MEIA ENTRADA' THEN 12790
  WHEN 'PISTA - SOLIDÁRIO' THEN 13790
  WHEN 'CADEIRA - MEIA ENTRADA' THEN 19790
  WHEN 'CADEIRA - SOLIDÁRIO' THEN 20790
  ELSE lot."priceInCents"
END,
"updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS event
JOIN "Organization" AS organization ON organization."id" = event."organizationId"
WHERE lot."eventId" = event."id"
  AND organization."slug" = 'tcr-ingressos'
  AND event."slug" = 'rodrigo-teaser-em-sao-caetano-do-sul-2026'
  AND lot."name" IN (
    'PISTA - MEIA ENTRADA',
    'PISTA - SOLIDÁRIO',
    'CADEIRA - MEIA ENTRADA',
    'CADEIRA - SOLIDÁRIO'
  );
