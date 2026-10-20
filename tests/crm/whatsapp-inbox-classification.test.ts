import { describe, expect, it } from "vitest";
import { conversationMembership, isHumanReply, isRefundRequest, isUnreadConversation } from "@/features/crm/whatsapp-inbox-classification";

describe("classificação independente da caixa de entrada", () => {
  it("abrir uma conversa não muda o estado de leitura; somente a marcação posterior o muda", () => {
    const inbound = new Date("2026-10-20T12:00:00Z");
    expect(isUnreadConversation(inbound, null)).toBe(true);
    expect(isUnreadConversation(inbound, new Date("2026-10-20T12:01:00Z"))).toBe(false);
    expect(isUnreadConversation(new Date("2026-10-20T12:02:00Z"), new Date("2026-10-20T12:01:00Z"))).toBe(true);
  });

  it("reconhece resposta humana mesmo sem solicitação do cliente ou após 24 horas", () => {
    const reply = { type: "BULK", status: "SENT", payload: { humanAdminUserId: "admin-1" } };
    expect(isHumanReply(reply)).toBe(true);
    expect(isHumanReply({ ...reply, status: "FAILED" })).toBe(false);
    expect(isHumanReply({ ...reply, payload: { source: "TCR_WHATSAPP_AI" } })).toBe(false);
    expect(isHumanReply({ ...reply, type: "CART_ABANDONMENT" })).toBe(false);
  });

  it("classifica pedidos de estorno sem confundir uma mensagem automática com resposta humana", () => {
    expect(isRefundRequest("Quero o estorno dos ingressos")).toBe(true);
    expect(isRefundRequest("Solicito reembolso da compra")).toBe(true);
    expect(isRefundRequest("Quero cancelar o ingresso")).toBe(true);
    expect(isRefundRequest("Quero saber o horário do evento")).toBe(false);
  });

  it("mantém o histórico humano e estorno após a janela de 24 horas e após leitura", () => {
    expect(conversationMembership({
      latestInboundAt: new Date("2026-10-18T10:00:00Z"),
      latestReadAt: new Date("2026-10-18T10:01:00Z"),
      hasHumanReply: true,
      isRefund: true,
      now: new Date("2026-10-20T10:00:00Z")
    })).toEqual({ unread: false, human: true, refund: true, canReply: false });
  });
});
