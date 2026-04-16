import { CouponStatus, CouponType } from "@prisma/client";
import { z } from "zod";

export const couponSchema = z.object({
  eventId: z.string().min(1),
  code: z.string().min(3).max(40),
  type: z.enum(CouponType),
  status: z.enum(CouponStatus).default(CouponStatus.ACTIVE),
  percentage: z.number().int().min(1).max(100).optional(),
  amountInCents: z.number().int().min(1).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional()
});

export type CouponInput = z.infer<typeof couponSchema>;
