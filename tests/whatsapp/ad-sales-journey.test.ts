import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logs: Array<{ payload: Record<string, unknown> }> = [];
const sentButtons: Array<{ url: string; buttonText: string; metadata?: Record<string, unknown> }> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: vi.fn(async () => [
      {
        id: "event-suzano", slug: "geriatricus-em-suzano-2026", title: "Geriatricus em Suzano",
        startsAt: new Date("2026-11-22T23:30:00Z"), salesStartsAt: null, salesEndsAt: null,
        seatMaps: [], lots: [{
          id: "cmv6vr75w000jl406g4fheaz8", name: "CADEIRA PRATA - SOLIDÁRIO", status: "ACTIVE",
          saleBadge: "NONE", priceInCents: 10000, minPerOrder: 1, maxPerOrder: 10,
          hasTypeOptions: false, totalQuantity: 100, reservedQuantity: 0, soldQuantity: 0,
          salesStartsAt: null, salesEndsAt: null, seats: []
        }]
      },
      {
        id: "event-andre", slug: "geriatricus-em-santo-andre-2026", title: "Geriatricus em Santo André",
        startsAt: new Date("2026-11-22T01:00:00Z"), salesStartsAt: null, salesEndsAt: null,
        seatMaps: [], lots: [{
          id: "cmv058yt70002kd6gmgbwij7e", name: "SETOR PRATA - SOLIDÁRIO", status: "ACTIVE",
          saleBadge: "NONE", priceInCents: 10000, minPerOrder: 1, maxPerOrder: 10,
          hasTypeOptions: false, totalQuantity: 100, reservedQuantity: 0, soldQuantity: 0,
          salesStartsAt: null, salesEndsAt: null, seats: []
        }]
      }
    ]) },
    whatsAppMessageLog: { findMany: vi.fn(async () => [...logs].reverse()) }
  }
}));

vi.mock("@/features/whatsapp/whatsapp.service", () => ({
  sendWhatsAppTextMessage: vi.fn(async (input: { source?: string; metadata?: Record<string, unknown> }) => {
    logs.push({ payload: { source: input.source, ...input.metadata } });
  }),
  sendWhatsAppUrlButtonMessage: vi.fn(async (input: { url: string; buttonText: string; source?: string; metadata?: Record<string, unknown> }) => {
    sentButtons.push(input);
    logs.push({ payload: { source: input.source, ...input.metadata } });
  })
}));

import { isAuthorizedAdSalesTestKeyword, processAdSalesJourney } from "@/features/whatsapp/ad-sales-journey";

beforeEach(() => {
  logs.length = 0;
  sentButtons.length = 0;
  process.env.WHATSAPP_SALES_PILOT_AD_IDS = "123";
  process.env.WHATSAPP_SALES_TEST_PHONES = "5511999999999";
});
afterEach(() => {
  delete process.env.WHATSAPP_SALES_PILOT_AD_IDS;
  delete process.env.WHATSAPP_SALES_TEST_PHONES;
});

describe("WhatsApp ad-sales journey", () => {
  const base = { organizationId: "tcr", phone: "5511999999999" };

  it("routes only the approved ad, then opens the selected checkout with quantity", async () => {
    expect(await processAdSalesJourney({ ...base, text: "Quero conhecer", origin: { kind: "meta_ad", adId: "999" } })).toBe(false);
    expect(await processAdSalesJourney({ ...base, text: "Quero tirar uma dúvida no site da TCR", origin: { kind: "meta_ad", adId: "123" } })).toBe(false);
    expect(await processAdSalesJourney({ ...base, text: "Olá", origin: { kind: "meta_ad", adId: "123" } })).toBe(true);
    expect(logs.at(-1)?.payload.step).toBe("choose_event");
    expect(await processAdSalesJourney({ ...base, text: "1" })).toBe(true);
    expect(logs.at(-1)?.payload.eventSlug).toBe("geriatricus-em-suzano-2026");
    expect(await processAdSalesJourney({ ...base, text: "1" })).toBe(true);
    expect(logs.at(-1)?.payload.step).toBe("choose_quantity");
    expect(await processAdSalesJourney({ ...base, text: "2" })).toBe(true);
    expect(sentButtons).toHaveLength(1);
    const url = new URL(sentButtons[0].url);
    expect(url.pathname).toBe("/evento/geriatricus-em-suzano-2026/checkout");
    expect(url.searchParams.get("quantity_cmv6vr75w000jl406g4fheaz8")).toBe("2");
    expect(sentButtons[0].buttonText).toBe("Comprar ingresso");
  });

  it("opens test journey only for an allowlisted phone and exact keyword", async () => {
    expect(isAuthorizedAdSalesTestKeyword({ ...base, text: "Diego teste 123" })).toBe(true);
    expect(isAuthorizedAdSalesTestKeyword({ ...base, phone: "5511888888888", text: "Diego teste 123" })).toBe(false);
    expect(await processAdSalesJourney({ ...base, phone: "5511888888888", text: "Diego teste 123" })).toBe(false);
    expect(await processAdSalesJourney({ ...base, text: "Diego teste" })).toBe(false);
    expect(await processAdSalesJourney({ ...base, text: "Diego teste 123" })).toBe(true);
    expect(logs.at(-1)?.payload.step).toBe("choose_event");
    expect(await processAdSalesJourney({ ...base, text: "2" })).toBe(true);
    expect(logs.at(-1)?.payload.eventSlug).toBe("geriatricus-em-santo-andre-2026");
    expect(await processAdSalesJourney({ ...base, text: "1" })).toBe(true);
    expect(await processAdSalesJourney({ ...base, text: "1" })).toBe(true);
    expect(sentButtons).toHaveLength(1);
    expect(new URL(sentButtons[0].url).pathname).toBe("/evento/geriatricus-em-santo-andre-2026/checkout");
  });
});
