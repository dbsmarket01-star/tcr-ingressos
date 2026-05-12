ALTER TABLE "HomeListEntry"
ADD COLUMN IF NOT EXISTS "notes" TEXT;

WITH existing_rooms AS (
  SELECT
    "organizationId",
    "eventId",
    "hotelId",
    COALESCE(MAX(NULLIF(REGEXP_REPLACE("roomNumber", '\D', '', 'g'), '')::integer), 0) AS max_room
  FROM "HomeListEntry"
  WHERE NULLIF(TRIM(COALESCE("roomNumber", '')), '') IS NOT NULL
  GROUP BY "organizationId", "eventId", "hotelId"
),
numbered_missing_rooms AS (
  SELECT
    h.id,
    LPAD(
      (
        ROW_NUMBER() OVER (
          PARTITION BY h."organizationId", h."eventId", h."hotelId"
          ORDER BY h."purchaseDate", h."createdAt", h.id
        ) + COALESCE(e.max_room, 0)
      )::text,
      2,
      '0'
    ) AS generated_room
  FROM "HomeListEntry" h
  LEFT JOIN existing_rooms e
    ON e."organizationId" = h."organizationId"
   AND e."eventId" = h."eventId"
   AND e."hotelId" = h."hotelId"
  WHERE NULLIF(TRIM(COALESCE(h."roomNumber", '')), '') IS NULL
)
UPDATE "HomeListEntry" h
SET "roomNumber" = numbered_missing_rooms.generated_room
FROM numbered_missing_rooms
WHERE h.id = numbered_missing_rooms.id;
