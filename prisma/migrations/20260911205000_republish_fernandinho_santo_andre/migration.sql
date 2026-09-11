-- Reagenda e republica o evento existente, preservando pedidos, ingressos e estoque vendido.
-- Valores e regras abaixo valem somente para novas compras deste evento.
BEGIN;

UPDATE "Event" e
SET
  "title" = 'Fernandinho em Santo André',
  "subtitle" = 'Show gospel com Fernandinho',
  "description" = E'Fernandinho, um dos maiores nomes da música gospel no Brasil, está de volta com sua nova turnê, trazendo mensagens poderosas de fé.\n\nCom sucessos que tocam gerações, como “Grandes Coisas”, “Faz Chover” e “Uma Nova História”, o cantor promete uma experiência emocionante, repleta da presença de Deus e momentos que ficarão guardados no coração.\n\nSerá um ano de milagres, transformação e recomeços — e essa noite será o primeiro passo dessa nova história!\n\nNão fique de fora! Garanta já o seu ingresso e venha viver essa experiência única de fé e celebração ao lado de Fernandinho!',
  "importantInfo" = E'Classificação livre. Duração aproximada: 90 minutos.\n\nEstacionamento nas proximidades. Local com acesso PCD.\n\nIngressos para crianças:\n- Até 2 anos: entrada gratuita.\n- De 2 a 12 anos: meia-entrada, quando disponível.\n- Acima de 12 anos: ingresso inteiro.\n\nEntrada solidária: leve 1 kg de alimento não perecível no dia do evento. Caso o participante não leve o alimento, será necessário pagar na entrada a diferença para o ingresso inteiro.',
  "bannerUrl" = 'https://www.phsis.com.br/files/20/image/20260902165725.png',
  "seoTitle" = 'Fernandinho em Santo André | TCR Ingressos',
  "seoDescription" = 'Garanta seu ingresso para Fernandinho em Santo André, dia 20 de novembro de 2026, às 21h, no Clube Atlético Aramaçan.',
  "seoImageUrl" = 'https://www.phsis.com.br/files/20/image/20260902165725.png',
  "eventMapImageUrl" = 'https://www.phsis.com.br/files/20/image/20260731094056.png',
  "eventMapNotes" = 'Mapa visual do evento com os setores Pista, Cadeira, Premium, Primeira Fileira e Camarote.',
  "startsAt" = TIMESTAMP '2026-11-20 21:00:00',
  "endsAt" = TIMESTAMP '2026-11-20 22:30:00',
  "doorsOpenAt" = NULL,
  "venueName" = 'Clube Atlético Aramaçan',
  "venueAddress" = 'R. São Pedro, 345 - Silveira, Santo André - SP, 09121-390',
  "city" = 'Santo André',
  "state" = 'SP',
  "salesStartsAt" = NOW(),
  "salesEndsAt" = TIMESTAMP '2026-11-20 21:00:00',
  "status" = 'PUBLISHED'
FROM "Organization" o
WHERE e."organizationId" = o."id"
  AND o."slug" = 'tcr-ingressos'
  AND e."slug" = 'fernandinho-santo-andre-2026';

UPDATE "TicketLot" tl
SET
  "priceInCents" = CASE tl."name"
    WHEN 'PISTA - MEIA ENTRADA' THEN 5790
    WHEN 'PISTA - SOLIDÁRIO' THEN 6790
    WHEN 'CADEIRA - MEIA ENTRADA' THEN 8790
    WHEN 'CADEIRA - SOLIDÁRIO' THEN 9790
    WHEN 'SETOR PREMIUM - MEIA ENTRADA' THEN 12790
    WHEN 'SETOR PREMIUM - SOLIDÁRIO' THEN 13790
    WHEN 'PRIMEIRA FILEIRA - EXCLUSIVO' THEN 29790
    WHEN 'CAMAROTE 18 - COMPARTILHADO' THEN 16790
    WHEN 'CAMAROTE PARA 10 PESSOAS' THEN 149790
  END,
  "serviceFeeBps" = 750,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "sortOrder" = CASE tl."name"
    WHEN 'PISTA - MEIA ENTRADA' THEN 0
    WHEN 'PISTA - SOLIDÁRIO' THEN 1
    WHEN 'CADEIRA - MEIA ENTRADA' THEN 2
    WHEN 'CADEIRA - SOLIDÁRIO' THEN 3
    WHEN 'SETOR PREMIUM - MEIA ENTRADA' THEN 4
    WHEN 'SETOR PREMIUM - SOLIDÁRIO' THEN 5
    WHEN 'PRIMEIRA FILEIRA - EXCLUSIVO' THEN 6
    WHEN 'CAMAROTE 18 - COMPARTILHADO' THEN 7
    WHEN 'CAMAROTE PARA 10 PESSOAS' THEN 8
  END,
  "status" = 'ACTIVE'
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
WHERE tl."eventId" = e."id"
  AND o."slug" = 'tcr-ingressos'
  AND e."slug" = 'fernandinho-santo-andre-2026'
  AND tl."name" IN (
    'PISTA - MEIA ENTRADA',
    'PISTA - SOLIDÁRIO',
    'CADEIRA - MEIA ENTRADA',
    'CADEIRA - SOLIDÁRIO',
    'SETOR PREMIUM - MEIA ENTRADA',
    'SETOR PREMIUM - SOLIDÁRIO',
    'PRIMEIRA FILEIRA - EXCLUSIVO',
    'CAMAROTE 18 - COMPARTILHADO',
    'CAMAROTE PARA 10 PESSOAS'
  );

DO $$
DECLARE
  configured_lots INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO configured_lots
  FROM "TicketLot" tl
  INNER JOIN "Event" e ON e."id" = tl."eventId"
  INNER JOIN "Organization" o ON o."id" = e."organizationId"
  WHERE o."slug" = 'tcr-ingressos'
    AND e."slug" = 'fernandinho-santo-andre-2026'
    AND tl."status" = 'ACTIVE'
    AND tl."serviceFeeBps" = 750
    AND tl."cardInterestBpsPerInstallment" = 400
    AND tl."cardInterestStartsAtInstallment" = 2;

  IF configured_lots <> 9 THEN
    RAISE EXCEPTION 'Esperados 9 ingressos configurados, encontrados %', configured_lots;
  END IF;
END $$;

COMMIT;
