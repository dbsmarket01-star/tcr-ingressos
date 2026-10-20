-- Resumo incremental para a visão de histórico completo do CRM.
-- A chave usa a mesma normalização da consulta antiga.
CREATE TABLE IF NOT EXISTS "WhatsAppConversationCandidates" (
  "organizationId" text NOT NULL,
  "conversationKey" text NOT NULL,
  "messageIds" text[] NOT NULL DEFAULT '{}',
  "latestAt" timestamptz NOT NULL,
  PRIMARY KEY ("organizationId", "conversationKey")
);

CREATE INDEX IF NOT EXISTS "WhatsAppConversationCandidates_org_latest_idx"
  ON "WhatsAppConversationCandidates" ("organizationId", "latestAt" DESC);

CREATE OR REPLACE FUNCTION tcr_whatsapp_conversation_key(phone text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN left(digits, 2) = '55' AND length(digits) >= 12
    THEN substring(digits from 3) ELSE digits END
  FROM (SELECT regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') AS digits) p;
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "WhatsAppMessageLog_org_conversation_key_idx"
  ON "WhatsAppMessageLog" ("organizationId", tcr_whatsapp_conversation_key("recipientPhone"));

CREATE OR REPLACE FUNCTION tcr_refresh_whatsapp_conversation_candidates(org text, phone_key text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF org IS NULL OR phone_key IS NULL OR phone_key = '' THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(org || ':' || phone_key, 0));
  DELETE FROM "WhatsAppConversationCandidates"
    WHERE "organizationId" = org AND "conversationKey" = phone_key;
  INSERT INTO "WhatsAppConversationCandidates" ("organizationId", "conversationKey", "messageIds", "latestAt")
  WITH ranked AS (
    SELECT m.id, m."createdAt", m.status, m.type, m."orderId", m."recipientName", m.payload, m."webhookPayload",
      row_number() OVER (ORDER BY m."createdAt" DESC, m.id DESC) AS position,
      row_number() OVER (PARTITION BY m.status = 'RECEIVED' ORDER BY m."createdAt" DESC, m.id DESC) AS direction_position,
      row_number() OVER (PARTITION BY m.type = 'CART_ABANDONMENT' AND m.status <> 'FAILED' ORDER BY m."createdAt" DESC, m.id DESC) AS cart_position,
      row_number() OVER (PARTITION BY m.type = 'BULK' AND m.status <> 'FAILED' AND nullif(m.payload->>'humanAdminUserId', '') IS NOT NULL ORDER BY m."createdAt" DESC, m.id DESC) AS human_position,
      row_number() OVER (PARTITION BY m."orderId" IS NOT NULL ORDER BY m."createdAt" DESC, m.id DESC) AS order_position,
      row_number() OVER (PARTITION BY m."recipientName" IS NOT NULL ORDER BY m."createdAt" DESC, m.id DESC) AS name_position
    FROM "WhatsAppMessageLog" m
    WHERE m."organizationId" = org AND tcr_whatsapp_conversation_key(m."recipientPhone") = phone_key
  )
  SELECT org, phone_key,
    array_agg(id ORDER BY "createdAt" DESC, id DESC) FILTER (WHERE
      position = 1 OR
      (status = 'RECEIVED' AND direction_position = 1) OR
      (status <> 'RECEIVED' AND direction_position = 1) OR
      (type = 'CART_ABANDONMENT' AND status <> 'FAILED' AND cart_position = 1) OR
      (type = 'BULK' AND status <> 'FAILED' AND nullif(payload->>'humanAdminUserId', '') IS NOT NULL AND human_position = 1) OR
      ("orderId" IS NOT NULL AND order_position = 1) OR
      ("recipientName" IS NOT NULL AND name_position = 1) OR
      (status = 'RECEIVED' AND (coalesce(payload::text, '') || coalesce("webhookPayload"::text, '')) ~* 'estorn|reembols|devol|cancel')
    ), max("createdAt")
  FROM ranked HAVING count(*) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION tcr_whatsapp_candidates_on_message_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_key text; new_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_key := tcr_whatsapp_conversation_key(OLD."recipientPhone");
    PERFORM tcr_refresh_whatsapp_conversation_candidates(OLD."organizationId", old_key);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_key := tcr_whatsapp_conversation_key(NEW."recipientPhone");
    IF TG_OP = 'INSERT' OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId" OR old_key IS DISTINCT FROM new_key THEN
      PERFORM tcr_refresh_whatsapp_conversation_candidates(NEW."organizationId", new_key);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "WhatsAppMessageLog_candidates_change" ON "WhatsAppMessageLog";
CREATE TRIGGER "WhatsAppMessageLog_candidates_change"
AFTER INSERT OR UPDATE OR DELETE ON "WhatsAppMessageLog"
FOR EACH ROW EXECUTE FUNCTION tcr_whatsapp_candidates_on_message_change();

-- Backfill only at migration time; subsequent writes are incremental.
SELECT tcr_refresh_whatsapp_conversation_candidates("organizationId", conversation_key)
FROM (
  SELECT DISTINCT "organizationId", tcr_whatsapp_conversation_key("recipientPhone") AS conversation_key
  FROM "WhatsAppMessageLog" WHERE "organizationId" IS NOT NULL
) conversations WHERE conversation_key <> '';
