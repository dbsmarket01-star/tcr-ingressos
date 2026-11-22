import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOrder, findEvent } = vi.hoisted(() => ({ findOrder: vi.fn(), findEvent: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: findOrder }, event: { findFirst: findEvent } } }));
vi.mock("@/features/email/email.service", () => ({ createPublicOrderUrl: vi.fn(() => "https://www.tcringressos.app.br/pedido/teste") }));

import { trackMetaAddToCart, trackMetaInitiateCheckoutForOrder } from "@/features/tracking/meta-conversions.service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

describe("Meta CAPI cart and checkout", () => {
  it("deduplicates AddToCart against the browser event and uses catalog prices", async () => {
    findEvent.mockResolvedValue({
      slug: "show", title: "Show de teste", metaPixelId: "123456789", metaConversionsApiToken: "secret", metaTestEventCode: null,
      lots: [{ id: "pista", priceInCents: 10000, maxPerOrder: 5 }]
    });
    const result = await trackMetaAddToCart({
      organizationId: "tcr", eventId: "event", trackingEventId: "cart:11111111-1111-4111-8111-111111111111",
      contents: [{ id: "pista", quantity: 2 }], sourceUrl: "https://tcringressos.com.br/evento/show",
      clientUserAgent: "browser", fbp: "fb.1.123.456"
    });
    expect(result).toEqual({ tracked: true });
    const call = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(call[1]?.body));
    expect(payload.data[0]).toMatchObject({
      event_name: "AddToCart", event_id: "cart:11111111-1111-4111-8111-111111111111",
      event_source_url: "https://tcringressos.com.br/evento/show",
      custom_data: { value: 200, content_ids: ["pista"], contents: [{ id: "pista", quantity: 2 }] }
    });
  });

  it("rejects lots outside the selected event without calling Meta", async () => {
    findEvent.mockResolvedValue({ slug: "show", title: "Show", metaPixelId: "123456789", metaConversionsApiToken: "secret", lots: [] });
    expect(await trackMetaAddToCart({ organizationId: "tcr", eventId: "event", trackingEventId: "cart:test",
      contents: [{ id: "other-event-lot", quantity: 1 }], sourceUrl: "https://tcringressos.com.br/evento/show", clientUserAgent: "browser"
    })).toEqual({ tracked: false, reason: "invalid_selection" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends InitiateCheckout with the same order code used by the browser Pixel", async () => {
    findOrder.mockResolvedValue({
      code: "ING-TEST", status: "PENDING_PAYMENT", createdAt: new Date("2026-11-22T12:00:00Z"),
      landingPage: "https://tcringressos.com.br/evento/show", clientUserAgent: "browser", totalInCents: 12000,
      currency: "BRL", customer: { email: "teste@example.com", phone: null },
      event: { title: "Show", metaPixelId: "123456789", metaConversionsApiToken: "secret", metaTestEventCode: null,
        organization: { name: "TCR", publicDomain: "tcringressos.app.br" } },
      items: [{ lotId: "pista", quantity: 1 }]
    });
    expect(await trackMetaInitiateCheckoutForOrder("order-id")).toEqual({ tracked: true });
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.data[0]).toMatchObject({ event_name: "InitiateCheckout", event_id: "ING-TEST",
      event_source_url: "https://tcringressos.com.br/evento/show", custom_data: { value: 120 } });
    expect(payload.data[0].user_data.em[0]).not.toBe("teste@example.com");
  });
});
