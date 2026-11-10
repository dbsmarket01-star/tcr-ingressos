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

  it("routes a code investigation mentioning tickets to repository tools", () => {
    expect(answerReadOnlyTicketQuestion(
      "Investigue no código qual arquivo implementa a listagem pública de ingressos do evento.", ranked, details
    )).toBeNull();
  });

  it("lists the actual order instead of merging sector names into one ticket", () => {
    const ordered = [{ ...details[0], lots: [
      { name: "PISTA - MEIA ENTRADA", priceInCents: 13790, status: "ACTIVE" },
      { name: "CADEIRA - INTEIRA", priceInCents: 45790, status: "SOLD_OUT" },
      { name: "PRIMEIRA FILEIRA - EXCLUSIVO", priceInCents: 49790, status: "ACTIVE" },
      { name: "CAMAROTE - SOLIDÁRIO", priceInCents: 15790, status: "PAUSED" }
    ] }];
    const answer = answerReadOnlyTicketQuestion(
      "Confira a ordem dos ingressos: pista, cadeira, primeira fileira e camarote. Não altere nada.", ranked, ordered
    );
    expect(answer).toContain("1. PISTA - MEIA ENTRADA");
    expect(answer).toContain("2. CADEIRA - INTEIRA");
    expect(answer).toContain("3. PRIMEIRA FILEIRA - EXCLUSIVO");
    expect(answer).toContain("CAMAROTE - SOLIDÁRIO — R$ 157,90 (pausado)");
    expect(answer).not.toContain("para “primeira fileira pista camarote”");
  });
});
