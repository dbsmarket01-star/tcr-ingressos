import { CouponStatus } from "@prisma/client";
import { z } from "zod";

export const couponTypeSchema = z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FINAL_UNIT_PRICE"]);

export const couponSchema = z.object({
  eventId: z.string().min(1),
  code: z.string().min(3).max(40),
  type: couponTypeSchema,
  status: z.enum(CouponStatus).default(CouponStatus.ACTIVE),
  percentage: z.number().int().min(1).max(100).optional(),
  amountInCents: z.number().int().min(1).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional()
}).superRefine((input, context) => {
  if (input.type === "PERCENTAGE" && !input.percentage) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o percentual de desconto.",
      path: ["percentage"]
    });
  }

  if ((input.type === "FIXED_AMOUNT" || input.type === "FINAL_UNIT_PRICE") && !input.amountInCents) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o valor em reais.",
      path: ["amountInCents"]
    });
  }
});

export type CouponInput = z.infer<typeof couponSchema>;
