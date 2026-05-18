import { z } from "zod";
import { MIN_PAYABLE_AMOUNT_IN_CENTS } from "@/features/pricing/pricing";

const minimumTicketPriceMessage = "O preço do ingresso precisa ser de pelo menos R$ 10,00 para ser aceito pelo Asaas.";

function validatePixDiscount(
  data: { priceInCents?: number; serviceFeeBps?: number; pixDiscountPercentBps: number; pixDiscountFixedInCents: number },
  ctx: z.RefinementCtx
) {
  if (data.pixDiscountPercentBps > 0 && data.pixDiscountFixedInCents > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Escolha apenas um tipo de desconto no Pix: percentual ou valor fixo.",
      path: ["pixDiscountPercentBps"]
    });
  }

  if (data.pixDiscountPercentBps >= 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O desconto Pix não pode zerar o pagamento. Use no máximo 99%.",
      path: ["pixDiscountPercentBps"]
    });
  }

  const priceInCents = data.priceInCents ?? 0;
  const serviceFeeBps = data.serviceFeeBps ?? 0;
  const minimumPayableAmount = priceInCents + Math.round(priceInCents * (serviceFeeBps / 10000));

  if (data.pixDiscountFixedInCents > 0 && data.pixDiscountFixedInCents > minimumPayableAmount - MIN_PAYABLE_AMOUNT_IN_CENTS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O desconto Pix precisa deixar pelo menos R$ 10,00 para pagamento.",
      path: ["pixDiscountFixedInCents"]
    });
  }
}

export const ticketLotPricingSchema = z.object({
  priceInCents: z.number().int().min(MIN_PAYABLE_AMOUNT_IN_CENTS, minimumTicketPriceMessage),
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
  highlightColor: z
    .union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma cor de destaque válida.")])
    .optional(),
  descriptionAsList: z.boolean().default(false),
  hasHotel: z.boolean().default(false),
  churchQuestionEnabled: z.boolean().default(false),
  hasTypeOptions: z.boolean().default(false),
  admissionsPerUnit: z.number().int().min(1).max(100).default(1),
  typeOptionsText: z.string().optional(),
  hotelId: z.string().optional(),
  newHotelName: z.string().optional(),
  newHotelCity: z.string().optional(),
  newHotelState: z.string().optional(),
  newHotelInternalNotes: z.string().optional(),
  newHotelAvailableRooms: z.number().int().min(0).optional(),
  priceInCents: z.number().int().min(MIN_PAYABLE_AMOUNT_IN_CENTS, minimumTicketPriceMessage),
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
    if (data.hasTypeOptions && !data.typeOptionsText?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe pelo menos um tipo/camarote para este ingresso.",
        path: ["typeOptionsText"]
      });
    }

    return;
  }

  if (data.hasTypeOptions && !data.typeOptionsText?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe pelo menos um tipo/camarote para este ingresso.",
      path: ["typeOptionsText"]
    });
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
