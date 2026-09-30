-- Production already contains this additive enum value. Keep new databases
-- and generated clients in sync without rewriting existing messages.
ALTER TYPE "WhatsAppMessageType" ADD VALUE IF NOT EXISTS 'AI_ASSISTANT';
