-- Sincroniza os precos publicados na plataforma legada e as regras comerciais
-- dos eventos Rodrigo Teaser em Mogi das Cruzes e Sessao Extra.
-- A alteracao afeta somente novas compras; pedidos existentes preservam seus snapshots.

UPDATE "TicketLot" AS tl
SET
  "priceInCents" = prices."priceInCents",
  "serviceFeeBps" = 750,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e,
(VALUES
  ('ARQUIBANCADA DUPLO-SOLIDÁRIO', 19790),
  ('ARQUIBANCADA - MEIA ENTRADA', 9790),
  ('ARQUIBANCADA - SOLIDÁRIO', 10790),
  ('PRATA DUPLO - SOLIDÁRIO', 25790),
  ('CADEIRA PRATA - MEIA ENTRADA', 12790),
  ('CADEIRA PRATA - SOLIDÁRIO', 13790),
  ('CADEIRA OURO DUPLO - SOLIDÁRIO', 33790),
  ('CADEIRA OURO - MEIA ENTRADA', 16790),
  ('CADEIRA OURO - SOLIDÁRIO', 17790),
  ('PRIMEIRA FILEIRA - EXCLUSIVO', 49790)
) AS prices("name", "priceInCents")
WHERE tl."eventId" = e.id
  AND prices."name" = tl."name"
  AND e.slug = 'rodrigo-teaser-em-mogi-das-cruzes';

UPDATE "TicketLot" AS tl
SET
  "priceInCents" = prices."priceInCents",
  "serviceFeeBps" = 750,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e,
(VALUES
  ('PISTA - SOLIDÁRIO', 9790),
  ('PISTA - MEIA ENTRADA', 9790),
  ('CADEIRA PRATA - SOLIDÁRIO', 14790),
  ('CADEIRA PRATA DUPLO-SOLIDÁRIO', 25790),
  ('CADEIRA PRATA - MEIA ENTRADA', 13790),
  ('CADEIRA OURO - SOLIDÁRIO', 20790),
  ('CADEIRA OURO DUPLO-SOLIDÁRIO', 31790),
  ('CADEIRA OURO - MEIA ENTRADA', 19790),
  ('PRIMEIRA FILEIRA - EXCLUSIVO', 59790)
) AS prices("name", "priceInCents")
WHERE tl."eventId" = e.id
  AND prices."name" = tl."name"
  AND e.slug = 'rodrigo-teaser-santo-andre-sessao-extra';

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "TicketLot" tl
    JOIN "Event" e ON e.id = tl."eventId"
    WHERE e.slug = 'rodrigo-teaser-em-mogi-das-cruzes'
      AND tl."serviceFeeBps" = 750
      AND tl."cardInterestBpsPerInstallment" = 400
      AND tl."cardInterestStartsAtInstallment" = 2
  ) <> 10 THEN
    RAISE EXCEPTION 'Nao foi possivel validar os 10 ingressos de Mogi das Cruzes';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM "TicketLot" tl
    JOIN "Event" e ON e.id = tl."eventId"
    WHERE e.slug = 'rodrigo-teaser-santo-andre-sessao-extra'
      AND tl."serviceFeeBps" = 750
      AND tl."cardInterestBpsPerInstallment" = 400
      AND tl."cardInterestStartsAtInstallment" = 2
  ) <> 9 THEN
    RAISE EXCEPTION 'Nao foi possivel validar os 9 ingressos da Sessao Extra';
  END IF;
END $$;
