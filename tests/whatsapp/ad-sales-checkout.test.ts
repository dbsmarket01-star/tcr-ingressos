import { describe, expect, it } from "vitest";
import { buildAdSalesCheckoutUrl, buildSorocabaQuantityUrl } from "@/features/whatsapp/ad-sales-checkout";

describe("WhatsApp sales checkout deep link", () => {
  it("opens the existing checkout with one lot and quantity, not a new payment flow", () => {
    const url = new URL(buildAdSalesCheckoutUrl({
      eventSlug: "geriatricus-em-suzano-2026",
      lotId: "cma1234567890123456789012",
      quantity: 2,
      adId: "123456789"
    }));
    expect(url.origin).toBe("https://www.tcringressos.app.br");
    expect(url.pathname).toBe("/evento/geriatricus-em-suzano-2026/checkout");
    expect(url.searchParams.get("lotId")).toBe("cma1234567890123456789012");
    expect(url.searchParams.get("quantity_cma1234567890123456789012")).toBe("2");
    expect(url.searchParams.get("utm_content")).toBe("123456789");
    expect(url.searchParams.get("utm_term")).toBe("verified_meta_referral");
    expect(url.hash).toBe("#resumo");
  });

  it("does not claim paid-ad origin for an ordinary WhatsApp conversation", () => {
    const url = new URL(buildAdSalesCheckoutUrl({
      eventSlug: "geriatricus-em-suzano-2026",
      lotId: "cma1234567890123456789012",
      quantity: 1,
      paidAd: false
    }));
    expect(url.searchParams.get("utm_medium")).toBe("organic");
    expect(url.searchParams.get("utm_term")).toBeNull();
  });

  it("rejects non-pilot events and invalid quantities", () => {
    expect(() => buildAdSalesCheckoutUrl({ eventSlug: "other", lotId: "cma1234567890123456789012", quantity: 1 })).toThrow();
    expect(() => buildAdSalesCheckoutUrl({ eventSlug: "geriatricus-em-santo-andre-2026", lotId: "cma1234567890123456789012", quantity: 0 })).toThrow();
  });

  it("opens the compact Sorocaba quantity page and caps direct checkout at 20", () => {
    const url = new URL(buildSorocabaQuantityUrl({ lotId: "cma1234567890123456789012", adId: "123" }));
    expect(url.pathname).toBe("/evento/rodrigo-teaser-em-sorocaba-2026/quantidade");
    expect(url.searchParams.get("adId")).toBe("123");
    expect(() => buildAdSalesCheckoutUrl({ eventSlug: "rodrigo-teaser-em-sorocaba-2026", lotId: "cma1234567890123456789012", quantity: 21 })).toThrow();
    expect(buildAdSalesCheckoutUrl({ eventSlug: "rodrigo-teaser-em-sorocaba-2026", lotId: "cma1234567890123456789012", quantity: 20 })).toContain("quantity_cma1234567890123456789012=20");
  });
});
