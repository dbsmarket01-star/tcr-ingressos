import { z } from "zod";

export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  tradeName: z.string().trim().min(2).max(120),
  document: z.string().trim().min(11).max(32),
  supportEmail: z.string().trim().email(),
  supportPhone: z.string().trim().max(32).optional(),
  defaultCurrency: z.string().trim().min(3).max(3).default("BRL"),
  platformFeePercent: z.coerce.number().min(0).max(30).default(0),
  orderReservationMinutes: z.coerce.number().int().min(15).max(1440).default(120),
  cardPendingReservationMinutes: z.coerce.number().int().min(5).max(240).default(30)
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
