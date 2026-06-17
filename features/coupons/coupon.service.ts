import { CouponStatus, CouponType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CouponInput } from "./coupon.schema";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type CouponDiscountItem = {
  quantity: number;
  totalInCents: number;
  serviceFeeInCents: number;
};

export function calculateCouponEligibleAmountInCents(subtotalInCents: number, serviceFeeInCents: number) {
  return Math.max(subtotalInCents + serviceFeeInCents, 0);
}

export function calculateCouponDiscountInCents(
  coupon: Pick<Prisma.CouponGetPayload<Record<string, never>>, "type" | "percentage" | "amountInCents">,
  eligibleAmountInCents: number,
  items: CouponDiscountItem[] = []
) {
  if (eligibleAmountInCents <= 0) {
    return 0;
  }

  if (coupon.type === CouponType.PERCENTAGE) {
    return Math.min(
      eligibleAmountInCents,
      Math.round(eligibleAmountInCents * ((coupon.percentage ?? 0) / 100))
    );
  }

  if (coupon.type === CouponType.FINAL_UNIT_PRICE) {
    const finalUnitPriceInCents = coupon.amountInCents ?? 0;

    if (finalUnitPriceInCents <= 0) {
      return 0;
    }

    const discountInCents = items.reduce((sum, item) => {
      if (item.quantity <= 0) {
        return sum;
      }

      const currentItemTotalInCents = item.totalInCents + item.serviceFeeInCents;
      const desiredItemTotalInCents = finalUnitPriceInCents * item.quantity;
      return sum + Math.max(currentItemTotalInCents - desiredItemTotalInCents, 0);
    }, 0);

    return Math.min(eligibleAmountInCents, discountInCents);
  }

  return Math.min(eligibleAmountInCents, coupon.amountInCents ?? 0);
}

export async function createCoupon(input: CouponInput) {
  return prisma.coupon.create({
    data: {
      eventId: input.eventId,
      code: normalizeCouponCode(input.code),
      type: input.type,
      status: input.status,
      percentage: input.type === CouponType.PERCENTAGE ? input.percentage ?? 0 : null,
      amountInCents:
        input.type === CouponType.FIXED_AMOUNT || input.type === CouponType.FINAL_UNIT_PRICE
          ? input.amountInCents ?? 0
          : null,
      maxRedemptions: input.maxRedemptions || null,
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null
    }
  });
}

export async function updateCouponStatus(couponId: string, status: CouponStatus) {
  return prisma.coupon.update({
    where: {
      id: couponId
    },
    data: {
      status
    }
  });
}

export async function getValidCouponForEvent(tx: Prisma.TransactionClient, eventId: string, code?: string) {
  const normalizedCode = normalizeCouponCode(code || "");

  if (!normalizedCode) {
    return null;
  }

  const now = new Date();
  const coupon = await tx.coupon.findUnique({
    where: {
      eventId_code: {
        eventId,
        code: normalizedCode
      }
    }
  });

  if (!coupon || coupon.status !== CouponStatus.ACTIVE) {
    throw new Error("Cupom invalido ou indisponivel.");
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    throw new Error("Cupom ainda nao esta disponivel.");
  }

  if (coupon.endsAt && coupon.endsAt < now) {
    throw new Error("Cupom expirado.");
  }

  if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new Error("Cupom esgotado.");
  }

  return coupon;
}
