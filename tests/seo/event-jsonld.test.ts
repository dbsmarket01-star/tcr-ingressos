import { describe, expect, it } from "vitest";
import { buildEventJsonLd } from "@/features/seo/event-jsonld";

describe("event JSON-LD", () => {
  it("uses the São Paulo time and the lowest available active offer", () => {
    const event = {
      title: "Rodrigo Teaser em Sorocaba",
      description: "Show ao vivo",
      startsAt: new Date("2026-12-01T00:00:00.000Z"),
      endsAt: null,
      venueName: "Clube Recreativo de Sorocaba",
      venueAddress: "Rua Exemplo, 650",
      city: "Sorocaba",
      state: "SP",
      bannerUrl: "https://example.com/banner.jpg",
      seoImageUrl: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z")
    };
    const lots = [
      { priceInCents: 15790, status: "ACTIVE", saleBadge: "NONE", salesStartsAt: null, totalQuantity: 1000, soldQuantity: 0, reservedQuantity: 0 },
      { priceInCents: 9900, status: "PAUSED", saleBadge: "NONE", salesStartsAt: null, totalQuantity: 1000, soldQuantity: 0, reservedQuantity: 0 }
    ];
    const result = buildEventJsonLd(event as never, lots as never, "https://www.tcringressos.app.br/evento/rodrigo-teaser-em-sorocaba-2026", "TCR Ingressos", "https://www.tcringressos.app.br");
    expect(result.startDate).toBe("2026-11-30T21:00:00-03:00");
    expect(result.offers?.price).toBe("157.90");
    expect(result.location.address.addressLocality).toBe("Sorocaba");
  });
});
