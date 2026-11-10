import { describe, expect, it } from "vitest";
import { assistantAcknowledgement, isReadOnlyAssistantRequest } from "@/features/assistant/assistant-request";

describe("assistant conversation requests", () => {
  it.each([
    "Qual é o valor do Ouro? Não altere nada.",
    "Veja os ingressos, sem mudar nada",
    "Apenas consulte o evento",
    "Não faça alterações no preço",
    "Não organize os ingressos"
  ])("treats %s as read-only", (message) => {
    expect(isReadOnlyAssistantRequest(message)).toBe(true);
    expect(assistantAcknowledgement(message)).toContain("não farei nenhuma alteração");
  });

  it("keeps a clear price-change request eligible for a proposal", () => {
    expect(isReadOnlyAssistantRequest("Altere o Ouro Meia para R$ 157,90")).toBe(false);
    expect(assistantAcknowledgement("Altere o Ouro Meia para R$ 157,90")).toContain("sua confirmação");
  });

  it("allows an explicit event pause while protecting unrelated data", () => {
    const message = "Retire do ar o evento Rodrigo Teaser em Ribeirão Pires. Não altere ingressos nem outros eventos.";
    expect(isReadOnlyAssistantRequest(message)).toBe(false);
    expect(assistantAcknowledgement(message)).toContain("sua confirmação");
  });

  it("keeps an ordering request actionable when the user protects other fields", () => {
    const message = "Organize os ingressos por preço dentro de cada setor, sem mudar nenhum outro dado.";
    expect(isReadOnlyAssistantRequest(message)).toBe(false);
    expect(assistantAcknowledgement(message)).toContain("sua confirmação");
    expect(isReadOnlyAssistantRequest("Chat, quero que você organize os ingressos sem mudar os preços.")).toBe(false);
    expect(isReadOnlyAssistantRequest("Pode organizar os ingressos sem alterar as vendas?")).toBe(false);
  });
});

describe("audit: consultation versus confirmation", () => {
  it.each([
    "No Show Teste, mude o preço para R$ 100. Não altere nada antes de eu confirmar.",
    "Crie um rascunho, sem salvar até eu confirmar.",
    "Organize os ingressos sem mudar nenhum outro dado. Se já estiverem corretos, não grave nada."
  ])("allows preparing a proposal: %s", (message) => expect(isReadOnlyAssistantRequest(message)).toBe(false));
  it.each([
    "Altere o preço? Não altere nada, é só uma pergunta.",
    "Apenas analise o banner do evento neste print.",
    "Somente investigue o mapa, não salve nada."
  ])("does not propose a mutation: %s", (message) => expect(isReadOnlyAssistantRequest(message)).toBe(true));
});
