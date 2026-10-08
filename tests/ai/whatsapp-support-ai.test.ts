import { describe, expect, it } from "vitest";
import {
  buildExactCardInstallmentOptions,
  humanPauseUntil,
  isHumanHandoffRequest,
  parseWhatsAppAiDecision,
  resolveWhatsAppAiConversationMode
} from "@/features/ai/whatsapp-support-ai.service";

describe("exact checkout installment quotes", () => {
  it("uses the same gross-up calculation as the checkout", () => {
    const options = buildExactCardInstallmentOptions({
      subtotalInCents: 10_000,
      serviceFeeInCents: 2_000,
      items: [{ quantity: 1, totalInCents: 10_000, admissionsPerUnit: 1 }],
      splitRules: [],
      feeSettings: {
        pixTransactionFeeInCents: 200,
        cardBaseFeeBps: 400,
        cardAdditionalInstallmentFeeBps: 300,
        cardFirstInstallmentInterestFree: true
      },
      maxInstallments: 6
    });

    expect(options).toHaveLength(6);
    expect(options[0]).toEqual({ installments: 1, totalInCents: 11_800, installmentValueInCents: 11_800 });
    expect(options[5]).toEqual({ installments: 6, totalInCents: 13_883, installmentValueInCents: 2_314 });
  });

  it("preserves configured splits when they exceed the service fee", () => {
    const options = buildExactCardInstallmentOptions({
      subtotalInCents: 10_000,
      serviceFeeInCents: 1_000,
      items: [{ quantity: 1, totalInCents: 10_000, admissionsPerUnit: 2 }],
      splitRules: [
        { walletId: "diego", type: "PERCENTAGE", percentageBps: 1000, fixedValueInCents: null },
        { walletId: "lucas", type: "FIXED_PER_TICKET", percentageBps: null, fixedValueInCents: 150 }
      ],
      feeSettings: {
        pixTransactionFeeInCents: 200,
        cardBaseFeeBps: 400,
        cardAdditionalInstallmentFeeBps: 300,
        cardFirstInstallmentInterestFree: true
      },
      maxInstallments: 1
    });

    expect(options[0]).toEqual({ installments: 1, totalInCents: 11_300, installmentValueInCents: 11_300 });
  });
});

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
