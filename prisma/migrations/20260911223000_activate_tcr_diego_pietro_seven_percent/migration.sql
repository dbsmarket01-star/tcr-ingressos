-- Ativa os splits percentuais de Diego e Pietro em todas as novas compras da TCR.
-- O cálculo é feito sobre o valor líquido dos ingressos após descontos, sem incluir
-- taxa de bilheteria, juros ou outros acréscimos. Pedidos existentes não são alterados.
BEGIN;

UPDATE "PaymentSplitRule" psr
SET
  "type" = 'PERCENTAGE',
  "percentageBps" = 700,
  "fixedValueInCents" = NULL,
  "isActive" = TRUE,
  "updatedAt" = NOW()
FROM "Organization" o
WHERE psr."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos'
  AND LOWER(psr."name") IN ('diego', 'pietro');

DO $$
DECLARE
  configured_rules INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO configured_rules
  FROM "PaymentSplitRule" psr
  INNER JOIN "Organization" o ON o."id" = psr."organizationId"
  WHERE o."slug" = 'tcr-ingressos'
    AND LOWER(psr."name") IN ('diego', 'pietro')
    AND psr."type" = 'PERCENTAGE'
    AND psr."percentageBps" = 700
    AND psr."isActive" = TRUE;

  IF configured_rules <> 2 THEN
    RAISE EXCEPTION 'Esperadas 2 regras de split ativas em 7%%, encontradas %', configured_rules;
  END IF;
END $$;

COMMIT;
