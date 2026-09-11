-- Publica Rodrigo Teaser em Taubaté na operação TCR.
-- A capacidade inicial segue o padrão operacional de 500 unidades por ingresso.
-- Camarotes não fazem parte deste evento.
BEGIN;

INSERT INTO "Event" (
  "id",
  "organizationId",
  "slug",
  "title",
  "subtitle",
  "description",
  "bannerUrl",
  "eventMapImageUrl",
  "eventMapNotes",
  "googleMapsUrl",
  "startsAt",
  "endsAt",
  "venueName",
  "venueAddress",
  "city",
  "state",
  "status",
  "salesStartsAt",
  "salesEndsAt",
  "importantInfo",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "seoImageUrl",
  "createdAt",
  "updatedAt"
)
SELECT
  'evt_rodrigo_teaser_taubate_2026',
  o."id",
  'rodrigo-teaser-em-taubate-2026',
  'Rodrigo Teaser em Taubaté',
  'O maior tributo a Michael Jackson',
  E'Rodrigo Teaser é cantor, compositor, dançarino e produtor artístico brasileiro. Reconhecido internacionalmente por seu trabalho em homenagem a Michael Jackson, destaca-se pela excelência de suas performances, figurinos, coreografias e pela fidelidade aos espetáculos do Rei do Pop.\n\nAo longo de sua carreira, tem se apresentado para milhares de pessoas no Brasil e em diversos países, consolidando-se como um dos maiores intérpretes da obra de Michael Jackson no mundo.\n\nSetores disponíveis:\nPrimeira Fileira: setor exclusivo em frente ao palco.\nOuro: setor próximo ao palco, atrás da Primeira Fileira.\nPrata: cadeiras atrás do Setor Ouro.\n\nVenha viver essa experiência única. Garanta já o seu ingresso!',
  'https://www.phsis.com.br/files/20/image/20260909193637.png',
  'https://www.phsis.com.br/files/20/image/20260909201018.png',
  'Mapa visual do evento com os setores Cadeira Prata, Cadeira Ouro e Primeira Fileira.',
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3671.9929709853986!2d-45.549255099999996!3d-23.0240303!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ccf91915480745%3A0x8d24b8aec9e5cf32!2sAssocia%C3%A7%C3%A3o%20dos%20Empregados%20do%20Com%C3%A9rcio%20de%20Taubate!5e0!3m2!1spt-BR!2sbr!4v1788991746025!5m2!1spt-BR!2sbr',
  TIMESTAMP '2026-11-28 00:00:00',
  TIMESTAMP '2026-11-28 01:30:00',
  'Associação dos Empregados',
  'R. Juca Esteves, 500 - Centro, Taubaté - SP, 12080-330',
  'Taubaté',
  'SP',
  'PUBLISHED',
  NOW(),
  TIMESTAMP '2026-11-28 00:00:00',
  E'Classificação livre. Duração aproximada: 90 minutos.\n\nIngressos para crianças:\n- Até 2 anos: entrada gratuita.\n- De 2 a 12 anos: meia-entrada, quando disponível.\n- Acima de 12 anos: ingresso inteiro.\n\nEntrada solidária: leve 1 kg de alimento não perecível no dia do evento. Caso o participante não leve o alimento, será necessário pagar na entrada a diferença para o ingresso inteiro.\n\nOs valores dos ingressos podem sofrer alteração sem aviso prévio.',
  'Rodrigo Teaser em Taubaté | TCR Ingressos',
  'Garanta seu ingresso para Rodrigo Teaser em Taubaté, dia 27 de novembro de 2026, às 21h, na Associação dos Empregados.',
  'Rodrigo Teaser, Michael Jackson, Taubaté, show, TCR Ingressos',
  'https://www.phsis.com.br/files/20/image/20260909193637.png',
  NOW(),
  NOW()
FROM "Organization" o
WHERE o."slug" = 'tcr-ingressos'
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "TicketLot" (
  "id",
  "eventId",
  "name",
  "description",
  "highlightColor",
  "priceInCents",
  "serviceFeeBps",
  "cardInterestBpsPerInstallment",
  "cardInterestStartsAtInstallment",
  "totalQuantity",
  "minPerOrder",
  "maxPerOrder",
  "sortOrder",
  "status",
  "salesStartsAt",
  "salesEndsAt",
  "createdAt",
  "updatedAt"
)
SELECT
  lot."id",
  e."id",
  lot."name",
  lot."description",
  lot."highlightColor",
  lot."priceInCents",
  750,
  400,
  2,
  500,
  1,
  10,
  lot."sortOrder",
  'ACTIVE',
  NOW(),
  TIMESTAMP '2026-11-28 00:00:00',
  NOW(),
  NOW()
FROM "Event" e
INNER JOIN "Organization" o ON o."id" = e."organizationId"
CROSS JOIN (VALUES
  ('lot_rodrigo_taubate_prata_meia', 'CADEIRA PRATA - MEIA ENTRADA', 'Setor Cadeira Prata, atrás da Cadeira Ouro. Meia-entrada conforme regras vigentes.', '#B9B9B9', 11790, 0),
  ('lot_rodrigo_taubate_prata_solidario', 'CADEIRA PRATA - SOLIDÁRIO', 'Setor Cadeira Prata, atrás da Cadeira Ouro. Leve 1 kg de alimento não perecível na entrada.', '#B9B9B9', 12790, 1),
  ('lot_rodrigo_taubate_ouro_meia', 'CADEIRA OURO - MEIA ENTRADA', 'Setor Cadeira Ouro, próximo ao palco e atrás da Primeira Fileira. Meia-entrada conforme regras vigentes.', '#CCA114', 15790, 2),
  ('lot_rodrigo_taubate_ouro_solidario', 'CADEIRA OURO - SOLIDÁRIO', 'Setor Cadeira Ouro, próximo ao palco e atrás da Primeira Fileira. Leve 1 kg de alimento não perecível na entrada.', '#CCA114', 16790, 3),
  ('lot_rodrigo_taubate_primeira_fileira', 'PRIMEIRA FILEIRA - EXCLUSIVO', 'Setor exclusivo em frente ao palco.', '#40BF59', 49790, 4)
) AS lot("id", "name", "description", "highlightColor", "priceInCents", "sortOrder")
WHERE o."slug" = 'tcr-ingressos'
  AND e."slug" = 'rodrigo-teaser-em-taubate-2026'
ON CONFLICT ("id") DO NOTHING;

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
    AND e."slug" = 'rodrigo-teaser-em-taubate-2026'
    AND tl."status" = 'ACTIVE'
    AND tl."serviceFeeBps" = 750
    AND tl."cardInterestBpsPerInstallment" = 400
    AND tl."cardInterestStartsAtInstallment" = 2
    AND LOWER(tl."name") NOT LIKE '%camarote%';

  IF configured_lots <> 5 THEN
    RAISE EXCEPTION 'Esperados 5 ingressos sem camarote, encontrados %', configured_lots;
  END IF;
END $$;

COMMIT;
