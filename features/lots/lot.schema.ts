import { z } from "zod";

export const ticketLotSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  priceInCents: z.number().int().min(0),
  serviceFeeBps: z.number().int().min(0).max(3000).default(0),
  pixDiscountPercentBps: z.number().int().min(0).max(10000).default(0),
  pixDiscountFixedInCents: z.number().int().min(0).default(0),
  cardInterestBpsPerInstallment: z.number().int().min(0).max(1000).default(0),
  cardInterestStartsAtInstallment: z.number().int().min(1).max(12).default(2),
  totalQuantity: z.number().int().min(1),
  minPerOrder: z.number().int().min(1).default(1),
  maxPerOrder: z.number().int().min(1).default(10),
  salesStartsAt: z.coerce.date().optional(),
  salesEndsAt: z.coerce.date().optional()
}).superRefine((data, ctx) => {
  if (data.pixDiscountPercentBps > 0 && data.pixDiscountFixedInCents > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Escolha apenas um tipo de desconto no Pix: percentual ou valor fixo.",
      path: ["pixDiscountPercentBps"]
    });
  }
});

export type TicketLotInput = z.infer<typeof ticketLotSchema>;
