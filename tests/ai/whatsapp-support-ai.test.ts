import { describe, expect, it } from "vitest";
import { parseWhatsAppAiDecision } from "@/features/ai/whatsapp-support-ai.service";

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
