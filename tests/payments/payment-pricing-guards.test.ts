import { describe, expect, it } from "vitest";
import { calculatePixDiscountInCents, capDiscountToPayableAmount } from "@/features/pricing/pricing";
import { ticketLotPricingSchema } from "@/features/lots/lot.schema";

describe("payment pricing guards", () => {
  it("caps fixed Pix discounts so the payable amount keeps the Asaas minimum", () => {
    expect(calculatePixDiscountInCents(2500, 1, 0, 2500)).toBe(1500);
    expect(calculatePixDiscountInCents(2500, 1, 0, 5000)).toBe(1500);
  });

  it("caps percentage Pix discounts so the payable amount keeps the Asaas minimum", () => {
    expect(calculatePixDiscountInCents(2500, 1, 10000, 0)).toBe(1500);
  });

  it("does not apply a Pix discount when the order is already at the minimum payable amount", () => {
    expect(capDiscountToPayableAmount(1000, 500)).toBe(0);
    expect(calculatePixDiscountInCents(1000, 1, 5000, 500)).toBe(0);
  });

  it("rejects lot pricing below the Asaas Pix minimum", () => {
    const result = ticketLotPricingSchema.safeParse({
      priceInCents: 900,
      serviceFeeBps: 0,
      pixDiscountPercentBps: 0,
      pixDiscountFixedInCents: 0,
      cardInterestBpsPerInstallment: 0,
      cardInterestStartsAtInstallment: 2
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("pelo menos R$ 10,00");
  });

  it("rejects lot pricing that would publish a Pix payment below the Asaas minimum", () => {
    const result = ticketLotPricingSchema.safeParse({
      priceInCents: 2500,
      serviceFeeBps: 0,
      pixDiscountPercentBps: 0,
      pixDiscountFixedInCents: 2500,
      cardInterestBpsPerInstallment: 0,
      cardInterestStartsAtInstallment: 2
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("pelo menos R$ 10,00");
  });
});
