import { describe, expect, it } from "vitest";
import { buildAddToCartPayload } from "@/features/tracking/add-to-cart";

describe("Meta AddToCart payload", () => {
  it("reports selected lots and quantities without claiming a purchase", () => {
    const form = new FormData();
    form.set("quantity_pista", "2");
    form.set("quantity_camarote", "1");
    form.set("quantity_esgotado", "0");

    expect(buildAddToCartPayload(form, "Show de teste")).toEqual({
      content_name: "Show de teste",
      content_type: "product",
      content_ids: ["pista", "camarote"],
      contents: [{ id: "pista", quantity: 2 }, { id: "camarote", quantity: 1 }],
      num_items: 3,
      currency: "BRL"
    });
  });

  it("does not fire for an empty or invalid selection", () => {
    const form = new FormData();
    form.set("quantity_pista", "0");
    form.set("quantity_camarote", "NaN");
    expect(buildAddToCartPayload(form, "Show de teste")).toBeNull();
  });
});
