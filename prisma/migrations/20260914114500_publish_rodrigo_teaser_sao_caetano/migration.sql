-- Publica Rodrigo Teaser em Sao Caetano do Sul na operacao TCR.
-- Mantem o camarote M3 compartilhado e exclui o camarote mezanino para 10 pessoas.
BEGIN;

INSERT INTO "Event" (
  "id", "organizationId", "slug", "title", "subtitle", "description",
  "bannerUrl", "bannerPosition", "eventMapImageUrl", "eventMapNotes",
  "googleMapsUrl", "startsAt", "endsAt", "venueName", "venueAddress",
  "city", "state", "status", "salesStartsAt", "salesEndsAt",
  "importantInfo", "metaPixelId", "metaConversionsApiToken", "metaTestEventCode",
  "googleTagManagerId", "seoTitle", "seoDescription", "seoKeywords", "seoImageUrl",
  "supportWhatsappUrl", "couponsEnabled", "createdAt", "updatedAt"
)
SELECT
  'evt_rodrigo_teaser_sao_caetano_2026',
  o."id",
  'rodrigo-teaser-em-sao-caetano-do-sul-2026',
  'Rodrigo Teaser em São Caetano do Sul',
  'O maior tributo a Michael Jackson',
  E'Rodrigo Teaser é cantor, compositor, dançarino e produtor artístico brasileiro. Reconhecido internacionalmente por seu trabalho em homenagem a Michael Jackson, destaca-se pela excelência de suas performances, figurinos, coreografias e pela fidelidade aos espetáculos do Rei do Pop.\n\nAo longo de sua carreira, tem se apresentado para milhares de pessoas no Brasil e em diversos países, consolidando-se como um dos maiores intérpretes da obra de Michael Jackson no mundo.\n\nSETORES DISPONÍVEIS:\n\nPrimeira fileira: cadeira em frente ao palco, setor exclusivo.\nCadeira: setor frontal ao palco, atrás da Primeira Fileira, no piso inferior.\nPista: setor em pé, atrás do setor Cadeira, no piso inferior.\nCamarote M3 compartilhado: espaço no camarote superior.\n\nVenha viver essa experiência única. Garanta já o seu ingresso!',
  '/events/rodrigo-teaser-sao-caetano-2026/banner.png',
  'center center',
  '/events/rodrigo-teaser-sao-caetano-2026/map.png',
  'Mapa visual do Espaço Liv Music com Primeira Fileira, Cadeira, Pista e camarotes superiores.',
  'https://www.google.com/maps?q=Rua+Baraldi,+743,+Centro,+S%C3%A3o+Caetano+do+Sul,+SP&output=embed',
  TIMESTAMPTZ '2026-11-29 21:00:00-03:00',
  TIMESTAMPTZ '2026-11-29 23:00:00-03:00',
  'Espaço Liv Music',
  'Rua Baraldi, 743 - Centro',
  'São Caetano do Sul',
  'SP',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  TIMESTAMPTZ '2026-11-29 21:00:00-03:00',
  E'Classificação: Livre. Duração aproximada: 2 horas.\n\nIngressos para crianças:\n- Até 2 anos: entrada gratuita.\n- De 2 a 12 anos: meia-entrada, quando disponível.\n- Acima de 12 anos: ingresso inteiro.\n\nEntrada solidária: leve 1 kg de alimento não perecível na entrada no dia do evento.\n\nOs valores dos ingressos podem sofrer alteração sem aviso prévio.',
  template."metaPixelId",
  template."metaConversionsApiToken",
  template."metaTestEventCode",
  template."googleTagManagerId",
  'Rodrigo Teaser em São Caetano do Sul | TCR Ingressos',
  'Garanta seu ingresso para Rodrigo Teaser em São Caetano do Sul, dia 29 de novembro de 2026, às 21h, no Espaço Liv Music.',
  'Rodrigo Teaser, Michael Jackson, São Caetano do Sul, show, TCR Ingressos',
  '/events/rodrigo-teaser-sao-caetano-2026/banner.png',
  template."supportWhatsappUrl",
  template."couponsEnabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
LEFT JOIN "Event" template
  ON template."organizationId" = o."id"
 AND template."slug" = 'rodrigo-teaser-em-taubate-2026'
WHERE o."slug" = 'tcr-ingressos'
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "subtitle" = EXCLUDED."subtitle",
  "description" = EXCLUDED."description",
  "bannerUrl" = EXCLUDED."bannerUrl",
  "bannerPosition" = EXCLUDED."bannerPosition",
  "bannerCrop" = '{"x":50,"y":50,"zoom":1}',
  "eventMapImageUrl" = EXCLUDED."eventMapImageUrl",
  "eventMapNotes" = EXCLUDED."eventMapNotes",
  "googleMapsUrl" = EXCLUDED."googleMapsUrl",
  "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt",
  "venueName" = EXCLUDED."venueName",
  "venueAddress" = EXCLUDED."venueAddress",
  "city" = EXCLUDED."city",
  "state" = EXCLUDED."state",
  "status" = EXCLUDED."status",
  "salesEndsAt" = EXCLUDED."salesEndsAt",
  "importantInfo" = EXCLUDED."importantInfo",
  "metaPixelId" = EXCLUDED."metaPixelId",
  "metaConversionsApiToken" = EXCLUDED."metaConversionsApiToken",
  "metaTestEventCode" = EXCLUDED."metaTestEventCode",
  "googleTagManagerId" = EXCLUDED."googleTagManagerId",
  "seoTitle" = EXCLUDED."seoTitle",
  "seoDescription" = EXCLUDED."seoDescription",
  "seoKeywords" = EXCLUDED."seoKeywords",
  "seoImageUrl" = EXCLUDED."seoImageUrl",
  "supportWhatsappUrl" = EXCLUDED."supportWhatsappUrl",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "TicketLot" (
  "id", "eventId", "name", "description", "highlightColor", "priceInCents",
  "serviceFeeBps", "pixDiscountPercentBps", "pixDiscountFixedInCents",
  "cardInterestBpsPerInstallment", "cardInterestStartsAtInstallment",
  "totalQuantity", "minPerOrder", "maxPerOrder", "sortOrder", "status",
  "salesStartsAt", "salesEndsAt", "createdAt", "updatedAt"
)
SELECT
  lot."id", e."id", lot."name", lot."description", lot."highlightColor", lot."priceInCents",
  2000, 0, 0, 400, 1, 500, 1, 10, lot."sortOrder", 'ACTIVE',
  CURRENT_TIMESTAMP, TIMESTAMPTZ '2026-11-29 21:00:00-03:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Event" e
CROSS JOIN (VALUES
  ('lot_rodrigo_scs_pista_meia', 'PISTA - MEIA ENTRADA', 'Setor em pé, atrás do setor Cadeira. Meia-entrada conforme regras vigentes.', '#BF3F43', 9790, 0),
  ('lot_rodrigo_scs_pista_solidario', 'PISTA - SOLIDÁRIO', 'Setor em pé, atrás do setor Cadeira. Leve 1 kg de alimento não perecível na entrada.', '#BF3F43', 10790, 1),
  ('lot_rodrigo_scs_cadeira_meia', 'CADEIRA - MEIA ENTRADA', 'Setor frontal ao palco, atrás da Primeira Fileira. Meia-entrada conforme regras vigentes.', '#40BF59', 16790, 2),
  ('lot_rodrigo_scs_cadeira_solidario', 'CADEIRA - SOLIDÁRIO', 'Setor frontal ao palco, atrás da Primeira Fileira. Leve 1 kg de alimento não perecível na entrada.', '#40BF59', 17790, 3),
  ('lot_rodrigo_scs_primeira_fileira', 'PRIMEIRA FILEIRA - EXCLUSIVO', 'Cadeiras em frente ao palco, em setor exclusivo.', '#CCA114', 59790, 4),
  ('lot_rodrigo_scs_camarote_m3', 'CAMAROTE M3 - COMPARTILHADO', 'Lugar compartilhado no Camarote M3, no piso superior.', '#3673BF', 14790, 5)
) AS lot("id", "name", "description", "highlightColor", "priceInCents", "sortOrder")
WHERE e."slug" = 'rodrigo-teaser-em-sao-caetano-do-sul-2026'
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "highlightColor" = EXCLUDED."highlightColor",
  "priceInCents" = EXCLUDED."priceInCents",
  "serviceFeeBps" = 2000,
  "pixDiscountPercentBps" = 0,
  "pixDiscountFixedInCents" = 0,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 1,
  "maxPerOrder" = 10,
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

DO $$
DECLARE
  configured_lots INTEGER;
  excluded_lots INTEGER;
BEGIN
  SELECT COUNT(*) INTO configured_lots
  FROM "TicketLot" tl
  JOIN "Event" e ON e."id" = tl."eventId"
  WHERE e."slug" = 'rodrigo-teaser-em-sao-caetano-do-sul-2026'
    AND tl."status" = 'ACTIVE'
    AND tl."serviceFeeBps" = 2000
    AND tl."cardInterestBpsPerInstallment" = 400
    AND tl."cardInterestStartsAtInstallment" = 1;

  SELECT COUNT(*) INTO excluded_lots
  FROM "TicketLot" tl
  JOIN "Event" e ON e."id" = tl."eventId"
  WHERE e."slug" = 'rodrigo-teaser-em-sao-caetano-do-sul-2026'
    AND LOWER(tl."name") LIKE '%10 pessoas%';

  IF configured_lots <> 6 THEN
    RAISE EXCEPTION 'Esperados 6 ingressos configurados, encontrados %', configured_lots;
  END IF;
  IF excluded_lots <> 0 THEN
    RAISE EXCEPTION 'O camarote para 10 pessoas nao pode ser publicado';
  END IF;
END $$;

COMMIT;
