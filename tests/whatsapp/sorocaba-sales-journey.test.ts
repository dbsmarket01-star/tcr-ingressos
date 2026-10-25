import { describe, expect, it } from "vitest";
import { isSorocabaAdGreeting, sorocabaGroup, sorocabaLotChoiceTitle, sorocabaLotLine } from "@/features/whatsapp/sorocaba-sales-journey";
import { buildAdSalesCheckoutUrl } from "@/features/whatsapp/ad-sales-checkout";

describe("jornada de vendas de Sorocaba", () => {
  it("identifica a mensagem do anúncio mesmo sem o identificador do anúncio", () => {
    expect(isSorocabaAdGreeting("Olá, vim pelo anúncio do Rodrigo Tis em Sorocaba e tenho interesse no evento")).toBe(true);
    expect(isSorocabaAdGreeting("Rodrigo Tizer em Sorocaba")).toBe(true);
    expect(isSorocabaAdGreeting("Rodrigo Teaser em Sorocaba")).toBe(true);
    expect(isSorocabaAdGreeting("Sorocaba")).toBe(true);
    expect(isSorocabaAdGreeting("  SOROCABA  ")).toBe(true);
    expect(isSorocabaAdGreeting("Quero saber se tem evento em Sorocaba")).toBe(false);
    expect(isSorocabaAdGreeting("Sorocaba, por favor")).toBe(false);
    expect(isSorocabaAdGreeting("Quero ingressos para Rodrigo Teaser em Piracicaba")).toBe(false);
    expect(isSorocabaAdGreeting("Rodrigo Tizer em Piracicaba")).toBe(false);
  });

  it("agrupa setores e apresenta somente o preço do ingresso mais taxas", () => {
    expect(sorocabaGroup("CADEIRA PRATA - MEIA ENTRADA")).toBe("prata");
    expect(sorocabaGroup("CADEIRA OURO - SOLIDÁRIO")).toBe("ouro");
    expect(sorocabaGroup("PRIMEIRA FILEIRA - EXCLUSIVO")).toBe("primeira");
    expect(sorocabaGroup("MESA PARA 04 PESSOAS")).toBe("mesa");
    expect(sorocabaGroup("CAMAROTE 05 - COMPARTILHADO")).toBe("camarote");
    expect(sorocabaLotLine({ name: "CADEIRA PRATA - MEIA ENTRADA", description: null, priceInCents: 14790, admissionsPerUnit: 1 }))
      .toBe("⚪ *CADEIRA PRATA - MEIA ENTRADA*\nR$ 147,90 + taxas");
  });

  it("mostra títulos completos dentro do limite da Meta e explica a regra do ingresso", () => {
    expect(sorocabaLotChoiceTitle("CADEIRA PRATA - MEIA ENTRADA")).toBe("Prata · Meia-entrada");
    expect(sorocabaLotChoiceTitle("CADEIRA PRATA - SOLIDÁRIO")).toBe("Prata · Solidário");
    expect(sorocabaLotChoiceTitle("CAMAROTE 05 - COMPARTILHADO")).toBe("Camarote 05 compart.");
    expect(sorocabaLotChoiceTitle("CAMAROTE FECHADO PARA 08 PESSOAS")).toBe("Camarote fechado 08p");
    expect(sorocabaLotLine({
      name: "CADEIRA PRATA - SOLIDÁRIO", priceInCents: 15790, admissionsPerUnit: 1,
      description: "Setor com cadeiras, atrás da Cadeira Ouro. Levar 1 kg de alimento não perecível para doação."
    })).toContain("Levar 1 kg de alimento não perecível");
  });

  it("leva a opção numerada correta para o checkout", () => {
    const url = new URL(buildAdSalesCheckoutUrl({
      eventSlug: "rodrigo-teaser-em-sorocaba-2026",
      lotId: "cmvn1khke00011ynb8mxepl67",
      lotOptionId: "cmvn1khlt00031ynbow2j6v61",
      quantity: 1
    }));
    expect(url.hostname).toBe("www.tcringressos.app.br");
    expect(url.searchParams.get("lotOption_cmvn1khke00011ynb8mxepl67")).toBe("cmvn1khlt00031ynbow2j6v61");
    expect(url.searchParams.get("utm_campaign")).toBe("rodrigo_sorocaba_whatsapp");
  });
});
