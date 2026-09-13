-- TCR charges 4% per card installment, including a one-installment purchase.
-- OrderItem stores a pricing snapshot, so historical paid orders remain unchanged.
UPDATE "TicketLot" AS tl
SET
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 1
FROM "Event" AS e
JOIN "Organization" AS o ON o."id" = e."organizationId"
WHERE tl."eventId" = e."id"
  AND o."slug" = 'tcr-ingressos';
