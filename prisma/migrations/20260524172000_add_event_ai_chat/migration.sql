-- CreateEnum
CREATE TYPE "AiConversationChannel" AS ENUM ('SITE', 'WHATSAPP');

-- AlterEnum
ALTER TYPE "WhatsAppMessageType" ADD VALUE 'AI_ASSISTANT';

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AiHandoffStatus" AS ENUM ('NONE', 'REQUESTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "EventAiSettings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "siteWidgetTitle" TEXT NOT NULL DEFAULT 'Fale com a IA do evento',
    "siteWidgetSubtitle" TEXT NOT NULL DEFAULT 'Online agora',
    "siteWidgetButtonLabel" TEXT NOT NULL DEFAULT 'Tire suas dúvidas',
    "siteInitialMessage" TEXT NOT NULL DEFAULT 'Olá! Sou a assistente virtual deste evento. Posso te ajudar com informações sobre ingressos, setores, pagamento, local e dúvidas antes da compra.',
    "whatsappInitialMessage" TEXT NOT NULL DEFAULT 'Olá! Sou a assistente virtual da TCR Ingressos. Me diga qual evento você deseja informações que eu te ajudo.',
    "assistantName" TEXT NOT NULL DEFAULT 'Assistente do evento',
    "supportContact" TEXT,
    "entryRules" TEXT,
    "ageRating" TEXT,
    "refundPolicy" TEXT,
    "halfEntryPolicy" TEXT,
    "childrenPolicy" TEXT,
    "parkingInfo" TEXT,
    "accessibilityInfo" TEXT,
    "paymentInfo" TEXT,
    "purchaseCta" TEXT NOT NULL DEFAULT 'Garanta seu ingresso com segurança pelo site oficial.',
    "extraInformation" TEXT,
    "whatsappEventKeywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAiFaq" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAiFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "channel" "AiConversationChannel" NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "whatsappPhone" TEXT,
    "handoffStatus" "AiHandoffStatus" NOT NULL DEFAULT 'NONE',
    "handoffReason" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventAiSettings_eventId_key" ON "EventAiSettings"("eventId");
CREATE INDEX "EventAiSettings_isEnabled_idx" ON "EventAiSettings"("isEnabled");
CREATE INDEX "EventAiFaq_settingsId_isActive_sortOrder_idx" ON "EventAiFaq"("settingsId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "AiConversation_channel_sessionKey_key" ON "AiConversation"("channel", "sessionKey");
CREATE INDEX "AiConversation_organizationId_channel_lastMessageAt_idx" ON "AiConversation"("organizationId", "channel", "lastMessageAt");
CREATE INDEX "AiConversation_eventId_channel_lastMessageAt_idx" ON "AiConversation"("eventId", "channel", "lastMessageAt");
CREATE INDEX "AiConversation_handoffStatus_lastMessageAt_idx" ON "AiConversation"("handoffStatus", "lastMessageAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventAiSettings" ADD CONSTRAINT "EventAiSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAiFaq" ADD CONSTRAINT "EventAiFaq_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "EventAiSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
