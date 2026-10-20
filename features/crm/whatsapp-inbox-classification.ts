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
