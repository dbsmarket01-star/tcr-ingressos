import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLegacyImport, importPlanSchema, fingerprintImport, importRequested, sourceUrl } from "@/features/assistant/assistant-event-import";
const html = readFileSync(new URL("./fixtures/import-event.html", import.meta.url), "utf8");
export const sourceFixture = () => { const source = parseLegacyImport(html, "https://tcringressos.com.br/ficticio"); source.fingerprint = fingerprintImport(source); return source; };
export const planFixture = () => ({ source: sourceFixture(), startsAt: "2035-12-12T19:00:00-03:00", city: "São Paulo", state: "SP", venueName: "Auditório de Testes", venueAddress: "Rua Exemplo, 100", publish: false, noMapConfirmed: false, reviewed: true as const,
  serviceFeeBps: 1000, cardInterestBpsPerInstallment: 0, cardInterestStartsAtInstallment: 2, minPerOrder: 1, maxPerOrder: 10,
  tickets: [{ quantity: 10, admissionsPerUnit: 1, options: [], description: "Meia entrada", descriptionReviewed: true as const, priceInCents: 10000 }, { quantity: 20, admissionsPerUnit: 1, options: [], description: "Inteira", descriptionReviewed: true as const, priceInCents: 20000 }] });

describe("deterministic event import", () => {
  it("extracts actual event artwork, map, categories and exact prices without inventing the year or stock", () => {
    const source = sourceFixture(); expect(source.title).toBe("SHOW FICTÍCIO DE AUDITORIA"); expect(source.bannerUrl).toBe("https://media.example.org/banner.png"); expect(source.mapUrl).toBe("https://media.example.org/map.png");
    expect(source.tickets.map(t=>[t.name,t.priceInCents])).toEqual([["PRATA - MEIA ENTRADA",10000],["OURO - INTEIRA",20000]]); expect(source.dateText).not.toContain("2035"); expect(source).not.toHaveProperty("stock");
  });
  it("rejects changed template, duplicate names and missing prices instead of silently dropping tickets", () => {
    expect(()=>parseLegacyImport(html.replace("OURO - INTEIRA","PRATA - MEIA ENTRADA"), "https://tcringressos.com.br/ficticio")).toThrow();
    expect(()=>parseLegacyImport(html.replace("R$ 200,00", ""), "https://tcringressos.com.br/ficticio")).toThrow();
  });
  it("requires explicit quantities, fee rules and review", () => {
    expect(importPlanSchema.safeParse(planFixture()).success).toBe(true);
    for (const key of ["serviceFeeBps","cardInterestBpsPerInstallment","cardInterestStartsAtInstallment","reviewed","minPerOrder","maxPerOrder"]) { const plan = {...planFixture(),[key]:undefined}; expect(importPlanSchema.safeParse(plan).success).toBe(false); }
    expect(importPlanSchema.safeParse({...planFixture(), tickets: []}).success).toBe(false);
  });
  it("rejects price drift and incomplete or duplicate numbered units", () => {
    const plan = planFixture(); plan.tickets[0].priceInCents++; expect(importPlanSchema.safeParse(plan).success).toBe(false);
    const numbered = planFixture(); numbered.source.tickets[0].needsOptions = true; expect(importPlanSchema.safeParse(numbered).success).toBe(false);
  });
  it("requires explicit no-map confirmation and a valid banner", () => {
    const plan = planFixture(); plan.source.mapUrl = ""; expect(importPlanSchema.safeParse(plan).success).toBe(false); plan.noMapConfirmed = true; expect(importPlanSchema.safeParse(plan).success).toBe(true); plan.source.bannerUrl = ""; expect(importPlanSchema.safeParse(plan).success).toBe(false);
  });
  it("matches commands and rejects unrelated hosts", () => { expect(importRequested("Suba esse mesmo evento no nosso site")).toBe(true); expect(importRequested("Qual o preço?")).toBe(false); expect(sourceUrl("https://example.org/foo")).toBeNull(); });
  it("rejects a date or hour that conflicts with the public source", () => {
    expect(importPlanSchema.safeParse({...planFixture(), startsAt:"2035-12-13T19:00:00-03:00"}).success).toBe(false);
    expect(importPlanSchema.safeParse({...planFixture(), startsAt:"2035-12-12T20:00:00-03:00"}).success).toBe(false);
  });
  it("detects source content changes", () => { const s=sourceFixture(); const fingerprint=fingerprintImport(s); s.tickets[0].priceInCents++; expect(fingerprintImport(s)).not.toBe(fingerprint); });
});
