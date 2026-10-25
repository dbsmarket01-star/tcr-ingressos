export function isRefundRequest(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(estorn(?:o|ar|ado|amento)|reembols(?:o|ar|ado)|devol(?:ucao|ver|vam)\s+(?:do\s+)?dinheiro|cancel(?:ar|amento|amento\s+da)\s+(?:o\s+)?(?:pedido|compra|ingresso|bilhete))\b/.test(normalized);
}

export function isHumanReply(message: {
  type: string;
  status: string;
  payload: unknown;
}) {
  if (message.type !== "BULK" || message.status === "FAILED") return false;
  if (!message.payload || typeof message.payload !== "object" || Array.isArray(message.payload)) return false;
  const payload = message.payload as Record<string, unknown>;
  return typeof payload.humanAdminUserId === "string" && payload.humanAdminUserId.length > 0;
}

export function isUnreadConversation(latestInboundAt: Date | null, latestReadAt: Date | null) {
  return Boolean(latestInboundAt && (!latestReadAt || latestInboundAt > latestReadAt));
}

export function shouldClearUnread(latestInboundId: string | null, readMessageId: string | null | undefined) {
  return Boolean(latestInboundId && readMessageId && latestInboundId === readMessageId);
}

export function resolveOperationalQueue(input: {
  latestInboundAt: Date | null;
  aiMode: "ACTIVE" | "PAUSED" | "HANDOFF";
  refund: boolean;
  metaSales?: boolean;
  manual: { queue: string; at: Date } | null;
}) {
  const { latestInboundAt, aiMode, refund, metaSales, manual } = input;
  if (manual?.queue === "refund") return "refund";
  if (manual && (!latestInboundAt || latestInboundAt <= manual.at)) return manual.queue;
  if (refund) return "refund";
  if (aiMode !== "ACTIVE") return "human";
  if (manual?.queue === "followup" || manual?.queue === "closed") return manual.queue;
  if (metaSales) return "meta";
  return latestInboundAt && latestInboundAt >= new Date("2026-10-21T00:00:00-03:00") ? "ai" : "all";
}

export function metaSalesStage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const verifiedSorocaba = data.source === "TCR_SOROCABA_SALES" && data.paidAd === true;
  const verifiedPilot = data.source === "TCR_WHATSAPP_AD_SALES" && typeof data.adId === "string" && /^\d{1,30}$/.test(data.adId);
  if (!verifiedSorocaba && !verifiedPilot) return null;
  const step = typeof data.step === "string" ? data.step : "";
  if (["done", "checkout"].includes(step)) return "Link de compra enviado";
  if (["option", "quantity", "choose_quantity"].includes(step)) return "Escolhendo ingresso";
  if (["lot", "menu", "choose_lot"].includes(step)) return "Vendo setores";
  if (step === "choose_event") return "Escolhendo evento";
  return "Iniciou atendimento";
}

/** A sales bot response alone does not prove that the customer clicked a WhatsApp ad. */
export function isDirectMetaWhatsAppAdInbound(webhookPayload: unknown): boolean {
  if (!webhookPayload || typeof webhookPayload !== "object" || Array.isArray(webhookPayload)) return false;
  const data = webhookPayload as Record<string, unknown>;
  const referral = data.referral;
  if (referral && typeof referral === "object" && !Array.isArray(referral) &&
    (referral as Record<string, unknown>).source_type === "ad") return true;
  const origin = data._tcrOrigin;
  return Boolean(origin && typeof origin === "object" && !Array.isArray(origin) &&
    (origin as Record<string, unknown>).kind === "meta_ad");
}

export function isReplyToRecentDirectMetaAd(input: {
  reply: { createdAt: Date; payload: unknown };
  referrals: Array<{ createdAt: Date; webhookPayload: unknown }>;
}): boolean {
  const reply = input.reply.payload && typeof input.reply.payload === "object" && !Array.isArray(input.reply.payload)
    ? input.reply.payload as Record<string, unknown> : {};
  return input.referrals.some((entry) => {
    if (!isDirectMetaWhatsAppAdInbound(entry.webhookPayload)) return false;
    const elapsed = input.reply.createdAt.getTime() - entry.createdAt.getTime();
    if (elapsed < 0 || elapsed > 24 * 60 * 60 * 1000) return false;
    const inbound = entry.webhookPayload as Record<string, unknown>;
    const referral = inbound.referral && typeof inbound.referral === "object" && !Array.isArray(inbound.referral)
      ? inbound.referral as Record<string, unknown> : {};
    const sourceId = typeof referral.source_id === "string" ? referral.source_id : null;
    const replyAdId = typeof reply.adId === "string" ? reply.adId : null;
    return !sourceId || !replyAdId || sourceId === replyAdId;
  });
}

export function conversationMembership(input: {
  latestInboundAt: Date | null;
  latestReadAt: Date | null;
  hasHumanReply: boolean;
  isRefund: boolean;
  now: Date;
}) {
  return {
    unread: isUnreadConversation(input.latestInboundAt, input.latestReadAt),
    human: input.hasHumanReply,
    refund: input.isRefund,
    canReply: Boolean(input.latestInboundAt && input.now.getTime() - input.latestInboundAt.getTime() < 24 * 60 * 60 * 1000)
  };
}
