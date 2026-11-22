import { beforeEach, describe, expect, it, vi } from "vitest";

const { trackCart } = vi.hoisted(() => ({ trackCart: vi.fn() }));
vi.mock("@/features/organizations/organization.service", () => ({
  getCurrentOrganizationContext: vi.fn(async () => ({ isMatchedByHost: true, organization: { id: "tcr" } }))
}));
vi.mock("@/features/security/rate-limit", () => ({ assertRateLimit: vi.fn() }));
vi.mock("@/features/tracking/meta-conversions.service", () => ({ trackMetaAddToCart: trackCart }));

import { POST } from "@/app/api/public/meta/add-to-cart/route";

const validBody = {
  eventId: "event", trackingEventId: "cart:11111111-1111-4111-8111-111111111111",
  contents: [{ id: "pista", quantity: 1 }], sourceUrl: "https://tcringressos.com.br/evento/show"
};

beforeEach(() => vi.clearAllMocks());

describe("public AddToCart CAPI route", () => {
  it.each(["tcringressos.com.br", "www.tcringressos.app.br"])("accepts a same-domain cart event from %s", async (host) => {
    const response = await POST(new Request(`https://${host}/api/public/meta/add-to-cart`, {
      method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "test browser", Origin: `https://${host}` },
      body: JSON.stringify({ ...validBody, sourceUrl: `https://${host}/evento/show` })
    }));
    expect(response.status).toBe(204);
    expect(trackCart).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "tcr", eventId: "event", clientUserAgent: "test browser" }));
  });

  it("does not forward a different-domain source to Meta", async () => {
    const response = await POST(new Request("https://tcringressos.com.br/api/public/meta/add-to-cart", {
      method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "test browser" },
      body: JSON.stringify({ ...validBody, sourceUrl: "https://unrelated.example/evento/show" })
    }));
    expect(response.status).toBe(403);
    expect(trackCart).not.toHaveBeenCalled();
  });
});
