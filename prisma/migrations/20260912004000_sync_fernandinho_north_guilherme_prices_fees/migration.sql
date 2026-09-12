-- Sincroniza precos e taxas com os carrinhos da plataforma de referencia.
-- A taxa legada de 17% do total equivale a 20,48% sobre o preco-base.

UPDATE "TicketLot" AS tl
SET
  "serviceFeeBps" = 2048,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e
WHERE tl."eventId" = e.id
  AND e.slug = 'fernandinho-na-zona-norte';

UPDATE "TicketLot" AS tl
SET
  "priceInCents" = prices."priceInCents",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e,
(VALUES
  ('SETOR PISTA - SOLIDÁRIO', 8790),
  ('SETOR PISTA DUPLO - SOLIDÁRIO', 15790),
  ('CAD.PREMIUM DUPLO - SOLIDÁRIO', 23790),
  ('CADEIRA PREMIUM- SOLIDÁRIO', 12790),
  ('PRIMEIRA FILEIRA - EXCLUSIVO', 29790),
  ('CAMAROTE PARA 10 PESSOAS', 149790)
) AS prices("name", "priceInCents")
WHERE tl."eventId" = e.id
  AND prices."name" = tl.name
  AND e.slug = 'fernandinho-na-zona-norte';

UPDATE "TicketLot" AS tl
SET
  "serviceFeeBps" = 2048,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e
WHERE tl."eventId" = e.id
  AND e.slug = 'guilherme-arantes-sao-caetano-do-sul'
  AND tl.name <> 'INGRESSO TESTE - R$ 25';

UPDATE "TicketLot" AS tl
SET
  "priceInCents" = prices."priceInCents",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e,
(VALUES
  ('PISTA DUPLO - SOLIDÁRIO', 25790),
  ('PISTA - SOLIDÁRIO', 13790),
  ('PISTA - MEIA ENTRADA', 11790),
  ('CADEIRA DUPLO - SOLIDÁRIO', 41790),
  ('CADEIRA - SOLIDÁRIO', 21790),
  ('CADEIRA - MEIA ENTRADA', 19790),
  ('PRIMEIRA FILEIRA - EXCLUSIVO', 49790)
) AS prices("name", "priceInCents")
WHERE tl."eventId" = e.id
  AND prices."name" = tl.name
  AND e.slug = 'guilherme-arantes-sao-caetano-do-sul';

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "TicketLot" tl
    JOIN "Event" e ON e.id = tl."eventId"
    WHERE e.slug = 'fernandinho-na-zona-norte'
      AND tl."serviceFeeBps" = 2048
      AND tl."cardInterestBpsPerInstallment" = 400
      AND tl."cardInterestStartsAtInstallment" = 2
  ) <> 9 THEN
    RAISE EXCEPTION 'Nao foi possivel validar os 9 ingressos do Fernandinho Zona Norte';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM "TicketLot" tl
    JOIN "Event" e ON e.id = tl."eventId"
    WHERE e.slug = 'guilherme-arantes-sao-caetano-do-sul'
      AND tl.name <> 'INGRESSO TESTE - R$ 25'
      AND tl."serviceFeeBps" = 2048
      AND tl."cardInterestBpsPerInstallment" = 400
      AND tl."cardInterestStartsAtInstallment" = 2
  ) <> 7 THEN
    RAISE EXCEPTION 'Nao foi possivel validar os 7 ingressos comerciais do Guilherme Arantes';
  END IF;
END $$;
