import { CouponType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateCouponDiscountInCents } from "@/features/coupons/coupon.service";

describe("coupon discount calculation", () => {
  it("keeps percentage coupons capped to the eligible amount", () => {
    expect(
      calculateCouponDiscountInCents(
        {
          type: CouponType.PERCENTAGE,
          percentage: 10,
          amountInCents: null
        },
        250000
      )
    ).toBe(25000);
  });

  it("keeps fixed amount coupons capped to the eligible amount", () => {
    expect(
      calculateCouponDiscountInCents(
        {
          type: CouponType.FIXED_AMOUNT,
          percentage: null,
          amountInCents: 29700
        },
        25000
      )
    ).toBe(25000);
  });

  it("turns a lot price into the configured final unit price", () => {
    expect(
      calculateCouponDiscountInCents(
        {
          type: CouponType.FINAL_UNIT_PRICE,
          percentage: null,
          amountInCents: 250000
        },
        279700,
        [
          {
            quantity: 1,
            totalInCents: 279700,
            serviceFeeInCents: 0
          }
        ]
      )
    ).toBe(29700);
  });

  it("does not create negative discounts when the final unit price is higher than the item", () => {
    expect(
      calculateCouponDiscountInCents(
        {
          type: CouponType.FINAL_UNIT_PRICE,
          percentage: null,
          amountInCents: 300000
        },
        279700,
        [
          {
            quantity: 1,
            totalInCents: 279700,
            serviceFeeInCents: 0
          }
        ]
      )
    ).toBe(0);
  });
});
