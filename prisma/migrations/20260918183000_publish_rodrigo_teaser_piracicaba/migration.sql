-- Publica Rodrigo Teaser em Piracicaba na operação TCR.
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
  'evt_rodrigo_teaser_piracicaba_2026',
  organization."id",
  'rodrigo-teaser-em-piracicaba-2026',
  'Rodrigo Teaser em Piracicaba',
  'O maior tributo a Michael Jackson',
  E'Rodrigo Teaser é cantor, compositor, dançarino e produtor artístico brasileiro. Reconhecido internacionalmente por seu trabalho em homenagem a Michael Jackson, destaca-se pela excelência de suas performances, figurinos, coreografias e pela fidelidade aos espetáculos do Rei do Pop.\n\nAo longo de sua carreira, tem se apresentado para milhares de pessoas no Brasil e em diversos países, consolidando-se como um dos maiores intérpretes da obra de Michael Jackson no mundo.\n\nSETORES DISPONÍVEIS:\n\nPrimeira Fileira: setor exclusivo em frente ao palco.\nCadeira Ouro: setor próximo ao palco, atrás da Primeira Fileira.\nCadeira Prata: cadeiras atrás do Setor Ouro.\nMezanino: setor em pé localizado no piso superior do espaço.\n\nVenha viver essa experiência única. Garanta já o seu ingresso!',
  '/events/rodrigo-teaser-piracicaba-2026/banner.png',
  'center center',
  '{"x":50,"y":50,"zoom":1}',
  '/events/rodrigo-teaser-piracicaba-2026/map.png',
  'Mapa visual do Clube Cristóvão Colombo com Primeira Fileira, Cadeira Ouro, Cadeira Prata e Mezanino.',
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3679.9636968399855!2d-47.62952342469496!3d-22.729590679380166!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94c63050c74ef945%3A0xa08905b0e581e263!2sC.C.R.C.C.%20Crist%C3%B3v%C3%A3o%20Colombo!5e0!3m2!1spt-BR!2sbr!4v1789734033331!5m2!1spt-BR!2sbr',
  TIMESTAMPTZ '2026-11-28 21:00:00-03:00',
  TIMESTAMPTZ '2026-11-28 23:00:00-03:00',
  'Clube Cristóvão Colombo',
  'Av. Prof. Alberto Vollet Sachs, 2300 - Morumbi, Piracicaba - SP, 13417-820',
  'Piracicaba',
  'SP',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  TIMESTAMPTZ '2026-11-28 21:00:00-03:00',
  E'Classificação: Livre. Duração aproximada: 2 horas.\n\nIngressos para crianças:\n- Até 2 anos: entrada gratuita.\n- De 2 a 12 anos: meia-entrada, quando disponível.\n- Acima de 12 anos: ingresso inteiro.\n\nEntrada solidária: leve 1 kg de alimento não perecível na entrada no dia do evento. Caso o participante não leve o alimento, será necessário pagar na entrada a diferença para o ingresso inteiro.\n\nOs valores dos ingressos podem sofrer alteração sem aviso prévio.',
  template."metaPixelId",
  template."metaConversionsApiToken",
  template."metaTestEventCode",
  template."googleTagManagerId",
  'Rodrigo Teaser em Piracicaba | TCR Ingressos',
  'Garanta seu ingresso para Rodrigo Teaser em Piracicaba, dia 28 de novembro de 2026, às 21h, no Clube Cristóvão Colombo.',
  'Rodrigo Teaser, Michael Jackson, Piracicaba, show, TCR Ingressos',
  '/events/rodrigo-teaser-piracicaba-2026/banner.png',
  template."supportWhatsappUrl",
  template."couponsEnabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
LEFT JOIN "Event" AS template
  ON template."organizationId" = organization."id"
 AND template."slug" = 'rodrigo-teaser-em-sao-caetano-do-sul-2026'
WHERE organization."slug" = 'tcr-ingressos'
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "subtitle" = EXCLUDED."subtitle",
  "description" = EXCLUDED."description",
  "bannerUrl" = EXCLUDED."bannerUrl",
  "bannerPosition" = EXCLUDED."bannerPosition",
  "bannerCrop" = EXCLUDED."bannerCrop",
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
  lot."id", event."id", lot."name", lot."description", lot."highlightColor", lot."priceInCents",
  2000, 0, 0, 400, 2, 500, 1, 10, lot."sortOrder", 'ACTIVE',
  CURRENT_TIMESTAMP, TIMESTAMPTZ '2026-11-28 21:00:00-03:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Event" AS event
CROSS JOIN (VALUES
  ('lot_rodrigo_piracicaba_mezanino_meia', 'MEZANINO - MEIA ENTRADA', 'Setor em pé localizado no piso superior. Meia-entrada conforme regras vigentes.', '#3673BF', 12790, 0),
  ('lot_rodrigo_piracicaba_mezanino_solidario', 'MEZANINO - SOLIDÁRIO', 'Setor em pé localizado no piso superior. Leve 1 kg de alimento não perecível na entrada.', '#3673BF', 13790, 1),
  ('lot_rodrigo_piracicaba_prata_meia', 'CADEIRA PRATA - MEIA ENTRADA', 'Cadeiras atrás do Setor Ouro. Meia-entrada conforme regras vigentes.', '#B9B9B9', 15790, 2),
  ('lot_rodrigo_piracicaba_prata_solidario', 'CADEIRA PRATA - SOLIDÁRIO', 'Cadeiras atrás do Setor Ouro. Leve 1 kg de alimento não perecível na entrada.', '#B9B9B9', 16790, 3),
  ('lot_rodrigo_piracicaba_ouro_meia', 'CADEIRA OURO - MEIA ENTRADA', 'Setor próximo ao palco, atrás da Primeira Fileira. Meia-entrada conforme regras vigentes.', '#CCA114', 19790, 4),
  ('lot_rodrigo_piracicaba_ouro_solidario', 'CADEIRA OURO - SOLIDÁRIO', 'Setor próximo ao palco, atrás da Primeira Fileira. Leve 1 kg de alimento não perecível na entrada.', '#CCA114', 20790, 5),
  ('lot_rodrigo_piracicaba_primeira_fileira', 'PRIMEIRA FILEIRA - EXCLUSIVO', 'Setor exclusivo em frente ao palco.', '#40BF59', 49790, 6)
) AS lot("id", "name", "description", "highlightColor", "priceInCents", "sortOrder")
WHERE event."slug" = 'rodrigo-teaser-em-piracicaba-2026'
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "highlightColor" = EXCLUDED."highlightColor",
  "priceInCents" = EXCLUDED."priceInCents",
  "serviceFeeBps" = 2000,
  "pixDiscountPercentBps" = 0,
  "pixDiscountFixedInCents" = 0,
  "cardInterestBpsPerInstallment" = 400,
  "cardInterestStartsAtInstallment" = 2,
  "maxPerOrder" = 10,
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

DO $$
DECLARE
  configured_lots INTEGER;
BEGIN
  SELECT COUNT(*) INTO configured_lots
  FROM "TicketLot" AS lot
  JOIN "Event" AS event ON event."id" = lot."eventId"
  JOIN "Organization" AS organization ON organization."id" = event."organizationId"
  WHERE organization."slug" = 'tcr-ingressos'
    AND event."slug" = 'rodrigo-teaser-em-piracicaba-2026'
    AND lot."status" = 'ACTIVE'
    AND lot."serviceFeeBps" = 2000
    AND lot."cardInterestBpsPerInstallment" = 400
    AND lot."cardInterestStartsAtInstallment" = 2;

  IF configured_lots <> 7 THEN
    RAISE EXCEPTION 'Esperados 7 ingressos configurados, encontrados %', configured_lots;
  END IF;
END $$;

COMMIT;
