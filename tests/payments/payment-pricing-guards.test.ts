import { describe, expect, it } from "vitest";
import { calculatePixDiscountInCents, capDiscountToPayableAmount } from "@/features/pricing/pricing";
import { ticketLotPricingSchema } from "@/features/lots/lot.schema";

describe("payment pricing guards", () => {
  it("caps fixed Pix discounts so the payable amount never reaches zero", () => {
    expect(calculatePixDiscountInCents(2500, 1, 0, 2500)).toBe(2400);
    expect(calculatePixDiscountInCents(2500, 1, 0, 5000)).toBe(2400);
  });

  it("caps percentage Pix discounts so the payable amount never reaches zero", () => {
    expect(calculatePixDiscountInCents(2500, 1, 10000, 0)).toBe(2400);
  });

  it("does not apply a Pix discount when the order is already at the minimum payable amount", () => {
    expect(capDiscountToPayableAmount(100, 50)).toBe(0);
    expect(calculatePixDiscountInCents(100, 1, 5000, 50)).toBe(0);
  });

  it("rejects lot pricing that would publish a zero-value Pix payment", () => {
    const result = ticketLotPricingSchema.safeParse({
      priceInCents: 2500,
      serviceFeeBps: 0,
      pixDiscountPercentBps: 0,
      pixDiscountFixedInCents: 2500,
      cardInterestBpsPerInstallment: 0,
      cardInterestStartsAtInstallment: 2
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("pelo menos R$ 1,00");
  });
});
