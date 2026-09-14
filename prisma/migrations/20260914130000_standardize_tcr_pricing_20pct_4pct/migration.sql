-- Padroniza exclusivamente a operacao TCR:
-- 20% de taxa sobre o valor-base do ingresso e 4% por parcela desde 1x.
-- Pedidos existentes preservam os valores gravados no momento da compra.
BEGIN;

UPDATE "CompanySettings" AS settings
SET
  "platformFeeBps" = 2000,
  "cardBaseFeeBps" = 400,
  "cardAdditionalInstallmentFeeBps" = 400,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Organization" AS organization
WHERE settings."organizationId" = organization."id"
  AND organization."slug" = 'tcr-ingressos';

UPDATE "TicketLot" AS lot
SET
  "serviceFeeBps" = 2000,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 1,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Event" AS event
JOIN "Organization" AS organization ON organization."id" = event."organizationId"
WHERE lot."eventId" = event."id"
  AND organization."slug" = 'tcr-ingressos';

DO $$
DECLARE
  total_lots INTEGER;
  configured_lots INTEGER;
  settings_ok INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_lots
  FROM "TicketLot" lot
  JOIN "Event" event ON event."id" = lot."eventId"
  JOIN "Organization" organization ON organization."id" = event."organizationId"
  WHERE organization."slug" = 'tcr-ingressos';

  SELECT COUNT(*) INTO configured_lots
  FROM "TicketLot" lot
  JOIN "Event" event ON event."id" = lot."eventId"
  JOIN "Organization" organization ON organization."id" = event."organizationId"
  WHERE organization."slug" = 'tcr-ingressos'
    AND lot."serviceFeeBps" = 2000
    AND lot."cardInterestBpsPerInstallment" = 400
    AND lot."cardInterestStartsAtInstallment" = 1;

  SELECT COUNT(*) INTO settings_ok
  FROM "CompanySettings" settings
  JOIN "Organization" organization ON organization."id" = settings."organizationId"
  WHERE organization."slug" = 'tcr-ingressos'
    AND settings."platformFeeBps" = 2000
    AND settings."cardBaseFeeBps" = 400
    AND settings."cardAdditionalInstallmentFeeBps" = 400;

  IF total_lots = 0 OR configured_lots <> total_lots THEN
    RAISE EXCEPTION 'Falha na padronizacao TCR: % de % ingressos configurados', configured_lots, total_lots;
  END IF;

  IF settings_ok <> 1 THEN
    RAISE EXCEPTION 'O padrao de novos ingressos da TCR nao foi atualizado';
  END IF;
END $$;

COMMIT;
