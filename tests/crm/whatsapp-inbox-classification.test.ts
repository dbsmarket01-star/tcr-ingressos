import { describe, expect, it } from "vitest";
import { conversationMembership, isHumanReply, isRefundRequest, isUnreadConversation, metaSalesStage, resolveOperationalQueue, shouldClearUnread } from "@/features/crm/whatsapp-inbox-classification";

describe("classificação independente da caixa de entrada", () => {
  it("o estado lido acompanha a confirmação persistida da mensagem aberta e não apaga uma nova", () => {
    const inbound = new Date("2026-10-20T12:00:00Z");
    expect(isUnreadConversation(inbound, null)).toBe(true);
    expect(isUnreadConversation(inbound, new Date("2026-10-20T12:01:00Z"))).toBe(false);
    expect(isUnreadConversation(new Date("2026-10-20T12:02:00Z"), new Date("2026-10-20T12:01:00Z"))).toBe(true);
    expect(shouldClearUnread("mensagem-aberta", "mensagem-aberta")).toBe(true);
    expect(shouldClearUnread("mensagem-nova", "mensagem-aberta")).toBe(false);
    expect(shouldClearUnread(null, "mensagem-aberta")).toBe(false);
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

  it("mantém uma conversa na fila IA mesmo após a leitura e após resposta humana anterior", () => {
    const inbound = new Date("2026-10-21T15:00:00Z");
    expect(resolveOperationalQueue({ latestInboundAt: inbound, aiMode: "ACTIVE", refund: false, manual: null })).toBe("ai");
    expect(resolveOperationalQueue({ latestInboundAt: inbound, aiMode: "HANDOFF", refund: false, manual: null })).toBe("human");
    expect(resolveOperationalQueue({ latestInboundAt: inbound, aiMode: "ACTIVE", refund: true, manual: null })).toBe("refund");
  });

  it("só conclui por ação manual e reabre ao receber nova mensagem", () => {
    const manual = { queue: "all", at: new Date("2026-10-21T15:00:00Z") };
    expect(resolveOperationalQueue({ latestInboundAt: new Date("2026-10-21T14:00:00Z"), aiMode: "ACTIVE", refund: false, manual })).toBe("all");
    expect(resolveOperationalQueue({ latestInboundAt: new Date("2026-10-21T16:00:00Z"), aiMode: "ACTIVE", refund: false, manual })).toBe("ai");
    expect(resolveOperationalQueue({ latestInboundAt: new Date("2026-10-20T14:00:00Z"), aiMode: "ACTIVE", refund: false, manual: null })).toBe("all");
    expect(resolveOperationalQueue({ latestInboundAt: new Date("2026-10-21T16:00:00Z"), aiMode: "ACTIVE", refund: false, manual: { ...manual, queue: "followup" } })).toBe("followup");
    expect(resolveOperationalQueue({ latestInboundAt: new Date("2026-10-21T16:00:00Z"), aiMode: "HANDOFF", refund: false, manual: { ...manual, queue: "followup" } })).toBe("human");
    expect(resolveOperationalQueue({ latestInboundAt: new Date("2026-10-21T16:00:00Z"), aiMode: "ACTIVE", refund: false, manual: { ...manual, queue: "refund" } })).toBe("refund");
  });

  it("só coloca a autovenda confirmada de anúncio Meta na fila própria e transfere pedidos humanos", () => {
    const inbound = new Date("2026-10-25T12:00:00Z");
    expect(metaSalesStage({ source: "TCR_SOROCABA_SALES", paidAd: true, step: "done" })).toBe("Link de compra enviado");
    expect(metaSalesStage({ source: "TCR_SOROCABA_SALES", paidAd: false, step: "done" })).toBeNull();
    expect(metaSalesStage({ source: "TCR_WHATSAPP_AD_SALES", adId: "123456", step: "menu" })).toBe("Vendo setores");
    expect(resolveOperationalQueue({ latestInboundAt: inbound, aiMode: "ACTIVE", refund: false, metaSales: true, manual: null })).toBe("meta");
    expect(resolveOperationalQueue({ latestInboundAt: inbound, aiMode: "HANDOFF", refund: false, metaSales: true, manual: null })).toBe("human");
    expect(resolveOperationalQueue({ latestInboundAt: inbound, aiMode: "ACTIVE", refund: false, metaSales: true, manual: { queue: "all", at: new Date("2026-10-25T12:01:00Z") } })).toBe("all");
  });
});
