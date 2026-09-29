import { describe, expect, it } from "vitest";
import {
  humanPauseUntil,
  isHumanHandoffRequest,
  parseWhatsAppAiDecision,
  resolveWhatsAppAiConversationMode
} from "@/features/ai/whatsapp-support-ai.service";

describe("WhatsApp support AI", () => {
  it("reads a structured Responses API decision", () => {
    expect(
      parseWhatsAppAiDecision({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  outcome: "AUTO_REPLY",
                  reply: "Olá! Como posso ajudar?",
                  reason: "Saudação segura.",
                  topic: "saudacao"
                })
              }
            ]
          }
        ]
      })
    ).toEqual({
      outcome: "AUTO_REPLY",
      reply: "Olá! Como posso ajudar?",
      reason: "Saudação segura.",
      topic: "saudacao"
    });
  });

  it("rejects an unknown outcome", () => {
    expect(() =>
      parseWhatsAppAiDecision({
        output_text: JSON.stringify({ outcome: "REFUND", reply: "", reason: "", topic: "" })
      })
    ).toThrow("decisao invalida");
  });
});

describe("human handoff intent", () => {
  it.each([
    "Quero falar com atendente",
    "preciso de uma atendente",
    "Tem como falar com uma pessoa?",
    "quero atendimento humano"
  ])("identifica solicitação humana: %s", (message) => {
    expect(isHumanHandoffRequest(message)).toBe(true);
  });

  it("não confunde uma dúvida comum com pedido de atendente", () => {
    expect(isHumanHandoffRequest("A cadeira duplo serve para duas pessoas?")).toBe(false);
  });
});

describe("human intervention pause", () => {
  it("pausa a IA por 12 horas por padrão", () => {
    const from = new Date("2026-09-29T15:00:00.000Z");
    expect(humanPauseUntil(from).toISOString()).toBe("2026-09-30T03:00:00.000Z");
  });

  it("mantém a pausa antes do prazo e reativa depois", () => {
    const metadata = { pausedUntil: "2026-09-30T03:00:00.000Z" };
    expect(resolveWhatsAppAiConversationMode({
      action: "WHATSAPP_AI_PAUSED",
      metadata,
      now: new Date("2026-09-30T02:59:59.000Z")
    })).toBe("PAUSED");
    expect(resolveWhatsAppAiConversationMode({
      action: "WHATSAPP_AI_PAUSED",
      metadata,
      now: new Date("2026-09-30T03:00:00.000Z")
    })).toBe("ACTIVE");
  });

  it("não expira uma solicitação de atendimento humano", () => {
    expect(resolveWhatsAppAiConversationMode({
      action: "WHATSAPP_AI_HANDOFF",
      metadata: { pausedUntil: "2026-09-29T03:00:00.000Z" },
      now: new Date("2026-09-30T03:00:00.000Z")
    })).toBe("HANDOFF");
  });
});
