import { z } from "zod";

function validatePixDiscount(
  data: { pixDiscountPercentBps: number; pixDiscountFixedInCents: number },
  ctx: z.RefinementCtx
) {
  if (data.pixDiscountPercentBps > 0 && data.pixDiscountFixedInCents > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Escolha apenas um tipo de desconto no Pix: percentual ou valor fixo.",
      path: ["pixDiscountPercentBps"]
    });
  }
}

export const ticketLotPricingSchema = z.object({
  priceInCents: z.number().int().min(0),
  serviceFeeBps: z.number().int().min(0).max(3000).default(0),
  pixDiscountPercentBps: z.number().int().min(0).max(10000).default(0),
  pixDiscountFixedInCents: z.number().int().min(0).default(0),
  cardInterestBpsPerInstallment: z.number().int().min(0).max(1000).default(0),
  cardInterestStartsAtInstallment: z.number().int().min(1).max(12).default(2)
}).superRefine(validatePixDiscount);

export const ticketLotSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  hasHotel: z.boolean().default(false),
  hotelId: z.string().optional(),
  newHotelName: z.string().optional(),
  newHotelCity: z.string().optional(),
  newHotelState: z.string().optional(),
  newHotelInternalNotes: z.string().optional(),
  newHotelAvailableRooms: z.number().int().min(0).optional(),
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
  validatePixDiscount(data, ctx);

  if (!data.hasHotel) {
    return;
  }

  if (!data.hotelId && !data.newHotelName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecione um hotel ou cadastre um novo.",
      path: ["hotelId"]
    });
  }

  if (data.newHotelName && (!data.newHotelCity || !data.newHotelState)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe cidade e UF do novo hotel.",
      path: ["newHotelCity"]
    });
  }
});

export type TicketLotInput = z.infer<typeof ticketLotSchema>;
export type TicketLotPricingInput = z.infer<typeof ticketLotPricingSchema>;
