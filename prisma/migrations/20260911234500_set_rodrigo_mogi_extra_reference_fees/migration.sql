-- Replica a taxa dos carrinhos legados de Mogi e da Sessao Extra.
-- No legado, 17% do total equivalem a 20,48% sobre o preco-base.

UPDATE "TicketLot" AS tl
SET
  "serviceFeeBps" = 2048,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e
WHERE tl."eventId" = e.id
  AND e.slug IN (
    'rodrigo-teaser-em-mogi-das-cruzes',
    'rodrigo-teaser-santo-andre-sessao-extra'
  );

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "TicketLot" tl
    JOIN "Event" e ON e.id = tl."eventId"
    WHERE e.slug IN (
      'rodrigo-teaser-em-mogi-das-cruzes',
      'rodrigo-teaser-santo-andre-sessao-extra'
    )
      AND tl."serviceFeeBps" = 2048
      AND tl."cardInterestBpsPerInstallment" = 400
      AND tl."cardInterestStartsAtInstallment" = 2
  ) <> 19 THEN
    RAISE EXCEPTION 'Nao foi possivel validar as taxas dos 19 ingressos';
  END IF;
END $$;
