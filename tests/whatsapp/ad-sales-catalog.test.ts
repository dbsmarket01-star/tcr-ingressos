import { afterEach, describe, expect, it } from "vitest";
import { eligibleSalesLots, isPilotAd, PILOT_EVENT_SLUGS } from "@/features/whatsapp/ad-sales-catalog";

afterEach(() => { delete process.env.WHATSAPP_SALES_PILOT_AD_IDS; });

describe("WhatsApp ad-sales pilot catalog", () => {
  it("only includes the two Geriatricus events", () => {
    expect(PILOT_EVENT_SLUGS).toEqual(["geriatricus-em-suzano-2026", "geriatricus-em-santo-andre-2026"]);
  });

  it("excludes numbered, unavailable and camarote/mesa products", () => {
    expect(eligibleSalesLots([
      { id: "a", name: "CADEIRA PRATA", status: "ACTIVE", priceInCents: 10000, available: 2, hasNumberedSeats: false },
      { id: "b", name: "CADEIRA 12", status: "ACTIVE", priceInCents: 10000, available: 2, hasNumberedSeats: true },
      { id: "c", name: "CAMAROTE 18", status: "ACTIVE", priceInCents: 10000, available: 2, hasNumberedSeats: false },
      { id: "d", name: "MESA VIP", status: "ACTIVE", priceInCents: 10000, available: 2, hasNumberedSeats: false },
      { id: "e", name: "CADEIRA OURO", status: "ACTIVE", priceInCents: 10000, available: 0, hasNumberedSeats: false },
      { id: "f", name: "PISTA", status: "PAUSED", priceInCents: 10000, available: 2, hasNumberedSeats: false },
      { id: "g", name: "LOTE COM OPÇÕES", status: "ACTIVE", priceInCents: 10000, available: 2, hasNumberedSeats: false, hasTypeOptions: true }
    ]).map((lot) => lot.id)).toEqual(["a"]);
  });

  it("does not start for arbitrary Meta ads", () => {
    expect(isPilotAd("123")).toBe(false);
    process.env.WHATSAPP_SALES_PILOT_AD_IDS = "123, 456";
    expect(isPilotAd("123")).toBe(true);
    expect(isPilotAd("789")).toBe(false);
  });
});
