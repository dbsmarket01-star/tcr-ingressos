-- Retira as meias-entradas da venda publica da Sessao Extra sem apagar o
-- historico de pedidos e ingressos ja emitidos.

UPDATE "TicketLot" AS tl
SET
  status = 'PAUSED',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS e
WHERE tl."eventId" = e.id
  AND e.slug = 'rodrigo-teaser-santo-andre-sessao-extra'
  AND tl.name IN (
    'PISTA - MEIA ENTRADA',
    'CADEIRA PRATA - MEIA ENTRADA',
    'CADEIRA OURO - MEIA ENTRADA'
  );

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "TicketLot" tl
    JOIN "Event" e ON e.id = tl."eventId"
    WHERE e.slug = 'rodrigo-teaser-santo-andre-sessao-extra'
      AND tl.name IN (
        'PISTA - MEIA ENTRADA',
        'CADEIRA PRATA - MEIA ENTRADA',
        'CADEIRA OURO - MEIA ENTRADA'
      )
      AND tl.status = 'PAUSED'
  ) <> 3 THEN
    RAISE EXCEPTION 'Nao foi possivel pausar as 3 meias-entradas da Sessao Extra';
  END IF;
END $$;
