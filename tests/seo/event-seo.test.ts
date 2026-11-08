import { describe, expect, it } from "vitest";
import { buildEventSeo } from "@/features/seo/event-seo";

const baseEvent = {
  title: "Rodrigo Teaser em Sorocaba",
  subtitle: null,
  description: "O maior tributo ao Rei do Pop.",
  startsAt: new Date("2026-12-01T00:00:00.000Z"),
  venueName: "Clube Recreativo",
  city: "Sorocaba",
  state: "SP",
  bannerUrl: "https://example.com/banner.jpg",
  slug: "rodrigo-teaser-em-sorocaba-2026",
  seoTitle: null,
  seoDescription: null,
  seoKeywords: null,
  seoImageUrl: null
};

describe("automatic event SEO", () => {
  it("uses the artist, city, date and venue when custom fields are empty", () => {
    const seo = buildEventSeo(baseEvent);
    expect(seo.title).toContain("Rodrigo Teaser em Sorocaba");
    expect(seo.title).toContain("30/11");
    expect(seo.description).toContain("Clube Recreativo, Sorocaba-SP");
    expect(seo.canonicalPath).toBe("/evento/rodrigo-teaser-em-sorocaba-2026");
  });

  it("adds the city to the default title when the event name omits it", () => {
    const seo = buildEventSeo({ ...baseEvent, title: "Rodrigo Teaser" });
    expect(seo.title).toContain("Rodrigo Teaser em Sorocaba");
  });

  it("preserves an explicitly edited SEO title", () => {
    const seo = buildEventSeo({ ...baseEvent, seoTitle: "Rodrigo Teaser | Ingressos em Sorocaba" });
    expect(seo.title).toBe("Rodrigo Teaser | Ingressos em Sorocaba");
  });
});
