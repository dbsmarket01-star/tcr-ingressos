-- A taxa padrão da TCR passa a ser 20% para ingressos atuais e futuros.
-- Rodrigo Teaser em Mogi das Cruzes permanece como exceção em 7,5%.
-- Pedidos e itens já criados guardam os próprios valores e não são alterados.
UPDATE "CompanySettings" cs
SET "platformFeeBps" = 2000
FROM "Organization" o
WHERE cs."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos';

UPDATE "TicketLot" tl
SET "serviceFeeBps" = CASE
  WHEN e."slug" = 'rodrigo-teaser-em-mogi-das-cruzes' THEN 750
  ELSE 2000
END
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE tl."eventId" = e."id"
  AND o."slug" = 'tcr-ingressos';
