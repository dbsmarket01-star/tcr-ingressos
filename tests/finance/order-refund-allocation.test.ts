import { describe, expect, it } from "vitest";
import { allocateOrderAmountsAfterRefund } from "@/features/finance/order-refund-allocation";

describe("partial refund allocation", () => {
  it("keeps only the non-refunded proportional amounts in financial reports", () => {
    expect(allocateOrderAmountsAfterRefund({
      totalInCents: 12000,
      subtotalInCents: 10000,
      serviceFeeInCents: 1500,
      cardInterestInCents: 500,
      refundedInCents: 3000
    })).toEqual({
      totalInCents: 9000,
      subtotalInCents: 7500,
      serviceFeeInCents: 1125,
      cardInterestInCents: 375,
      discountInCents: 0,
      pixDiscountInCents: 0,
      refundedInCents: 3000
    });
  });

  it("caps a refund at the order total", () => {
    expect(allocateOrderAmountsAfterRefund({
      totalInCents: 10000,
      subtotalInCents: 8000,
      serviceFeeInCents: 2000,
      cardInterestInCents: 0,
      refundedInCents: 12000
    }).totalInCents).toBe(0);
  });
});
