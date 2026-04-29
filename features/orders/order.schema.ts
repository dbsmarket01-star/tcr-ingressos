import { z } from "zod";

export const checkoutOrderSchema = z.object({
  eventId: z.string().min(1),
  eventSlug: z.string().min(1),
  buyerName: z.string().min(3),
  buyerEmail: z.string().email(),
  buyerDocument: z.string().min(5),
  buyerPhone: z.string().optional(),
  couponCode: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  referrer: z.string().optional(),
  landingPage: z.string().optional(),
  metaFbp: z.string().optional(),
  metaFbc: z.string().optional(),
  clientIpAddress: z.string().optional(),
  clientUserAgent: z.string().optional(),
  items: z
    .array(
      z.object({
        lotId: z.string().min(1),
        quantity: z.number().int().min(0)
      })
    )
    .refine((items) => items.some((item) => item.quantity > 0), {
      message: "Selecione pelo menos um ingresso."
    })
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
