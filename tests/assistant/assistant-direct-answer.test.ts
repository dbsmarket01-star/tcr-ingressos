import { describe, expect, it } from "vitest";
import { answerReadOnlyTicketQuestion } from "@/features/assistant/assistant-direct-answer";

describe("direct read-only ticket answer", () => {
  const ranked = [{ event: { id: "event-1", title: "Rodrigo Teaser em Sorocaba" }, score: 9 }];
  const details = [{ id: "event-1", title: "Rodrigo Teaser em Sorocaba", city: "Sorocaba", lots: [
    { name: "CADEIRA OURO - MEIA ENTRADA", priceInCents: 15790, status: "ACTIVE" },
    { name: "CADEIRA OURO - SOLIDÁRIO", priceInCents: 16790, status: "ACTIVE" },
    { name: "CADEIRA PRATA - MEIA ENTRADA", priceInCents: 12790, status: "ACTIVE" }
  ] }];

  it("answers the requested lot without changing anything", () => {
    const answer = answerReadOnlyTicketQuestion("Qual é o preço do ingresso Ouro Meia em Sorocaba? Não altere nada.", ranked, details);
    expect(answer).toContain("R$ 157,90");
    expect(answer).toContain("sem alterar nada");
    expect(answer).not.toContain("SOLIDÁRIO");
  });

  it("asks for an event when missing", () => {
    expect(answerReadOnlyTicketQuestion("Consulte o preço, sem alterar", [], [])).toContain("Informe o nome do evento");
  });
});
