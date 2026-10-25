import { describe, expect, it } from "vitest";
import { isSorocabaAdGreeting, sorocabaGroup, sorocabaLotLine } from "@/features/whatsapp/sorocaba-sales-journey";
import { buildAdSalesCheckoutUrl } from "@/features/whatsapp/ad-sales-checkout";

describe("jornada de vendas de Sorocaba", () => {
  it("identifica a mensagem do anúncio mesmo sem o identificador do anúncio", () => {
    expect(isSorocabaAdGreeting("Olá, vim pelo anúncio do Rodrigo Tis em Sorocaba e tenho interesse no evento")).toBe(true);
    expect(isSorocabaAdGreeting("Quero ingressos para Rodrigo Teaser em Piracicaba")).toBe(false);
  });

  it("agrupa setores e apresenta somente o preço do ingresso mais taxas", () => {
    expect(sorocabaGroup("CADEIRA PRATA - MEIA ENTRADA")).toBe("prata");
    expect(sorocabaGroup("CADEIRA OURO - SOLIDÁRIO")).toBe("ouro");
    expect(sorocabaGroup("PRIMEIRA FILEIRA - EXCLUSIVO")).toBe("primeira");
    expect(sorocabaGroup("MESA PARA 04 PESSOAS")).toBe("mesa");
    expect(sorocabaGroup("CAMAROTE 05 - COMPARTILHADO")).toBe("camarote");
    expect(sorocabaLotLine({ name: "CADEIRA PRATA - MEIA ENTRADA", priceInCents: 14790, admissionsPerUnit: 1 }))
      .toBe("⚪ *CADEIRA PRATA - MEIA ENTRADA*\nR$ 147,90 + taxas");
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
