-- Publica Rodrigo Teaser em Marilia na operacao TCR.
-- Replica rastreamento dos eventos Rodrigo Teaser e preserva o banner 2:1 sem cortes.
BEGIN;

INSERT INTO "Event" (
  "id", "organizationId", "slug", "title", "subtitle", "description",
  "bannerUrl", "bannerPosition", "bannerCrop", "eventMapImageUrl", "eventMapNotes",
  "googleMapsUrl", "startsAt", "endsAt", "venueName", "venueAddress",
  "city", "state", "status", "salesStartsAt", "salesEndsAt", "importantInfo",
  "metaPixelId", "metaConversionsApiToken", "metaTestEventCode", "googleTagManagerId",
  "seoTitle", "seoDescription", "seoKeywords", "seoImageUrl", "supportWhatsappUrl",
  "couponsEnabled", "createdAt", "updatedAt"
)
SELECT
  'evt_rodrigo_teaser_marilia_2026',
  organization."id",
  'rodrigo-teaser-em-marilia-2026',
  'Rodrigo Teaser em Marília',
  'O maior tributo a Michael Jackson',
  E'Rodrigo Teaser é cantor, compositor, dançarino e produtor artístico brasileiro. Reconhecido internacionalmente por seu trabalho em homenagem a Michael Jackson, destaca-se pela excelência de suas performances, figurinos, coreografias e pela fidelidade aos espetáculos do Rei do Pop.\n\nAo longo de sua carreira, tem se apresentado para milhares de pessoas no Brasil e em diversos países, consolidando-se como um dos maiores intérpretes da obra de Michael Jackson no mundo.\n\nSETORES DISPONÍVEIS:\n\nPrimeira Fileira: setor exclusivo em frente ao palco.\nCadeira Ouro: setor de cadeiras em frente ao palco.\nCadeira Prata: setor de cadeiras atrás da Cadeira Ouro.\nCadeira Bronze: setor de cadeiras atrás da Cadeira Prata.\n\nVenha viver essa experiência única. Garanta já o seu ingresso!',
  '/events/rodrigo-teaser-marilia-2026/banner.png',
  'center center',
  '{"x":50,"y":50,"zoom":1}',
  '/events/rodrigo-teaser-marilia-2026/map.png',
  'Mapa visual do Espaço T com Primeira Fileira, Cadeira Ouro, Cadeira Prata e Cadeira Bronze.',
  'https://www.google.com/maps?q=SP-294,+Vera+Cruz,+SP,+17560-000&output=embed',
  TIMESTAMPTZ '2026-11-26 21:00:00-03:00',
  TIMESTAMPTZ '2026-11-26 23:00:00-03:00',
  'Espaço T',
  'SP-294, s/n - Rodovia, Vera Cruz - SP, 17560-000',
  'Marília',
  'SP',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  TIMESTAMPTZ '2026-11-26 21:00:00-03:00',
  E'Classificação: Livre. Duração aproximada: 2 horas.\n\nIngressos para crianças:\n- Até 2 anos: entrada gratuita.\n- De 2 a 12 anos: meia-entrada, quando disponível.\n- Acima de 12 anos: ingresso inteiro.\n\nEntrada solidária: leve 1 kg de alimento não perecível na entrada no dia do evento.\n\nOs valores dos ingressos podem sofrer alteração sem aviso prévio.',
  template."metaPixelId",
  template."metaConversionsApiToken",
  template."metaTestEventCode",
  template."googleTagManagerId",
  'Rodrigo Teaser em Marília | TCR Ingressos',
  'Garanta seu ingresso para Rodrigo Teaser em Marília, dia 26 de novembro de 2026, às 21h, no Espaço T.',
  'Rodrigo Teaser, Michael Jackson, Marília, Vera Cruz, show, TCR Ingressos',
  '/events/rodrigo-teaser-marilia-2026/banner.png',
  template."supportWhatsappUrl",
  template."couponsEnabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
LEFT JOIN "Event" AS template
  ON template."organizationId" = organization."id"
 AND template."slug" = 'rodrigo-teaser-em-piracicaba-2026'
WHERE organization."slug" = 'tcr-ingressos'
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
  "description" = EXCLUDED."description", "bannerUrl" = EXCLUDED."bannerUrl",
  "bannerPosition" = EXCLUDED."bannerPosition", "bannerCrop" = EXCLUDED."bannerCrop",
  "eventMapImageUrl" = EXCLUDED."eventMapImageUrl", "eventMapNotes" = EXCLUDED."eventMapNotes",
  "googleMapsUrl" = EXCLUDED."googleMapsUrl", "startsAt" = EXCLUDED."startsAt",
  "endsAt" = EXCLUDED."endsAt", "venueName" = EXCLUDED."venueName",
  "venueAddress" = EXCLUDED."venueAddress", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "status" = EXCLUDED."status", "salesEndsAt" = EXCLUDED."salesEndsAt",
  "importantInfo" = EXCLUDED."importantInfo", "metaPixelId" = EXCLUDED."metaPixelId",
  "metaConversionsApiToken" = EXCLUDED."metaConversionsApiToken",
  "metaTestEventCode" = EXCLUDED."metaTestEventCode", "googleTagManagerId" = EXCLUDED."googleTagManagerId",
  "seoTitle" = EXCLUDED."seoTitle", "seoDescription" = EXCLUDED."seoDescription",
  "seoKeywords" = EXCLUDED."seoKeywords", "seoImageUrl" = EXCLUDED."seoImageUrl",
  "supportWhatsappUrl" = EXCLUDED."supportWhatsappUrl", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "TicketLot" (
  "id", "eventId", "name", "description", "highlightColor", "descriptionAsList", "priceInCents",
  "serviceFeeBps", "pixDiscountPercentBps", "pixDiscountFixedInCents",
  "cardInterestBpsPerInstallment", "cardInterestStartsAtInstallment",
  "totalQuantity", "minPerOrder", "maxPerOrder", "sortOrder", "status",
  "salesStartsAt", "salesEndsAt", "createdAt", "updatedAt"
)
SELECT
  lot."id", event."id", lot."name", lot."description", lot."highlightColor", TRUE, lot."priceInCents",
  2000, 0, 0, 400, 2, 500, 1, 10, lot."sortOrder", 'ACTIVE',
  CURRENT_TIMESTAMP, TIMESTAMPTZ '2026-11-26 21:00:00-03:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Event" AS event
CROSS JOIN (VALUES
  ('lot_rodrigo_marilia_bronze_solidario', 'CADEIRA BRONZE - SOLIDÁRIO', E'Setor com cadeiras.\nPor ordem de chegada.\nAtrás da Cadeira Prata.\n1 ingresso para o setor Cadeira Bronze.\nNecessário levar 1 kg de alimento para doação.', '#A93E22', 10790, 0),
  ('lot_rodrigo_marilia_bronze_meia', 'CADEIRA BRONZE - MEIA ENTRADA', E'Setor com cadeiras.\nPor ordem de chegada.\nAtrás da Cadeira Prata.\n1 ingresso para o setor Cadeira Bronze.\nNecessário se enquadrar na lei da meia-entrada.', '#A93E22', 9790, 1),
  ('lot_rodrigo_marilia_prata_solidario', 'CADEIRA PRATA - SOLIDÁRIO', E'Setor com cadeiras.\nPor ordem de chegada.\nAtrás da Cadeira Ouro.\n1 ingresso para o setor Cadeira Prata.\nNecessário levar 1 kg de alimento para doação.', '#B9B9B9', 13790, 2),
  ('lot_rodrigo_marilia_prata_meia', 'CADEIRA PRATA - MEIA ENTRADA', E'Setor com cadeiras.\nPor ordem de chegada.\nAtrás da Cadeira Ouro.\n1 ingresso para o setor Cadeira Prata.\nNecessário se enquadrar na lei da meia-entrada.', '#B9B9B9', 12790, 3),
  ('lot_rodrigo_marilia_ouro_solidario', 'CADEIRA OURO - SOLIDÁRIO', E'Setor de cadeiras.\nPor ordem de chegada.\nSetor em frente ao palco.\n1 ingresso para este evento.\nNecessário levar 1 kg de alimento para doação.', '#CCA114', 17790, 4),
  ('lot_rodrigo_marilia_ouro_meia', 'CADEIRA OURO - MEIA ENTRADA', E'Setor de cadeiras.\nPor ordem de chegada.\nSetor em frente ao palco.\n1 ingresso para este evento.\nNecessário se enquadrar na lei da meia-entrada.', '#CCA114', 16790, 5),
  ('lot_rodrigo_marilia_primeira_fileira', 'PRIMEIRA FILEIRA - EXCLUSIVO', E'Setor em frente ao palco.\nSetor com cadeiras.\nEspaço reservado para até 40 pessoas.', '#40BF59', 49790, 6)
) AS lot("id", "name", "description", "highlightColor", "priceInCents", "sortOrder")
WHERE event."slug" = 'rodrigo-teaser-em-marilia-2026'
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description",
  "descriptionAsList" = TRUE, "highlightColor" = EXCLUDED."highlightColor",
  "priceInCents" = EXCLUDED."priceInCents", "serviceFeeBps" = 2000,
  "pixDiscountPercentBps" = 0, "pixDiscountFixedInCents" = 0,
  "cardInterestBpsPerInstallment" = 400, "cardInterestStartsAtInstallment" = 2,
  "maxPerOrder" = 10, "sortOrder" = EXCLUDED."sortOrder", "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

DO $$
DECLARE configured_lots INTEGER; tracking_ok INTEGER;
BEGIN
  SELECT COUNT(*) INTO configured_lots
  FROM "TicketLot" lot JOIN "Event" event ON event."id" = lot."eventId"
  WHERE event."slug" = 'rodrigo-teaser-em-marilia-2026' AND lot."status" = 'ACTIVE'
    AND lot."serviceFeeBps" = 2000 AND lot."cardInterestBpsPerInstallment" = 400
    AND lot."cardInterestStartsAtInstallment" = 2;
  SELECT COUNT(*) INTO tracking_ok FROM "Event"
  WHERE "slug" = 'rodrigo-teaser-em-marilia-2026'
    AND "metaPixelId" IS NOT NULL AND "metaConversionsApiToken" IS NOT NULL;
  IF configured_lots <> 7 THEN RAISE EXCEPTION 'Esperados 7 ingressos configurados, encontrados %', configured_lots; END IF;
  IF tracking_ok <> 1 THEN RAISE EXCEPTION 'Pixel e API de conversoes precisam estar configurados'; END IF;
END $$;

COMMIT;
