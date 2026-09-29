import { describe, expect, it } from "vitest";
import { isHumanHandoffRequest, parseWhatsAppAiDecision } from "@/features/ai/whatsapp-support-ai.service";

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
