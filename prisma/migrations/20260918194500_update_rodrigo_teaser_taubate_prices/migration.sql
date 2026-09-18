-- Atualiza somente os preços dos ingressos de Rodrigo Teaser em Taubaté
-- conforme a bilheteria de referência em 18/09/2026.
UPDATE "TicketLot"
SET
  "priceInCents" = CASE "id"
    WHEN 'lot_rodrigo_taubate_prata_meia' THEN 14790
    WHEN 'lot_rodrigo_taubate_prata_solidario' THEN 15790
    WHEN 'lot_rodrigo_taubate_ouro_meia' THEN 19790
    WHEN 'lot_rodrigo_taubate_ouro_solidario' THEN 20790
    WHEN 'lot_rodrigo_taubate_primeira_fileira' THEN 49790
    ELSE "priceInCents"
  END,
  "updatedAt" = NOW()
WHERE "eventId" = 'evt_rodrigo_teaser_taubate_2026'
  AND "id" IN (
    'lot_rodrigo_taubate_prata_meia',
    'lot_rodrigo_taubate_prata_solidario',
    'lot_rodrigo_taubate_ouro_meia',
    'lot_rodrigo_taubate_ouro_solidario',
    'lot_rodrigo_taubate_primeira_fileira'
  );

DO $$
DECLARE
  matching_lots INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO matching_lots
  FROM "TicketLot"
  WHERE "eventId" = 'evt_rodrigo_teaser_taubate_2026'
    AND (
      ("id" = 'lot_rodrigo_taubate_prata_meia' AND "priceInCents" = 14790) OR
      ("id" = 'lot_rodrigo_taubate_prata_solidario' AND "priceInCents" = 15790) OR
      ("id" = 'lot_rodrigo_taubate_ouro_meia' AND "priceInCents" = 19790) OR
      ("id" = 'lot_rodrigo_taubate_ouro_solidario' AND "priceInCents" = 20790) OR
      ("id" = 'lot_rodrigo_taubate_primeira_fileira' AND "priceInCents" = 49790)
    );

  IF matching_lots <> 5 THEN
    RAISE EXCEPTION 'Esperados 5 preços atualizados em Taubaté, encontrados %', matching_lots;
  END IF;
END $$;
