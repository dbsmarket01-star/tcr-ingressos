import { CouponStatus, CouponType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CouponInput } from "./coupon.schema";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function calculateCouponDiscountInCents(
  coupon: Pick<Prisma.CouponGetPayload<Record<string, never>>, "type" | "percentage" | "amountInCents">,
  eligibleAmountInCents: number
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
      amountInCents: input.type === CouponType.FIXED_AMOUNT ? input.amountInCents ?? 0 : null,
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
