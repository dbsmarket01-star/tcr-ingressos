import { describe, expect, it } from "vitest";
import { assistantAcknowledgement, isReadOnlyAssistantRequest } from "@/features/assistant/assistant-request";

describe("assistant conversation requests", () => {
  it.each([
    "Qual é o valor do Ouro? Não altere nada.",
    "Veja os ingressos, sem mudar nada",
    "Apenas consulte o evento",
    "Não faça alterações no preço"
  ])("treats %s as read-only", (message) => {
    expect(isReadOnlyAssistantRequest(message)).toBe(true);
    expect(assistantAcknowledgement(message)).toContain("não farei nenhuma alteração");
  });

  it("keeps a clear price-change request eligible for a proposal", () => {
    expect(isReadOnlyAssistantRequest("Altere o Ouro Meia para R$ 157,90")).toBe(false);
    expect(assistantAcknowledgement("Altere o Ouro Meia para R$ 157,90")).toContain("sua confirmação");
  });
});
