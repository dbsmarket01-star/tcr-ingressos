import { z } from "zod";

export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  tradeName: z.string().trim().min(2).max(120),
  document: z.string().trim().min(11).max(32),
  supportEmail: z.string().trim().email(),
  supportPhone: z.string().trim().max(32).optional(),
  instagramUrl: z.union([z.literal(""), z.string().trim().url()]).optional(),
  facebookUrl: z.union([z.literal(""), z.string().trim().url()]).optional(),
  youtubeUrl: z.union([z.literal(""), z.string().trim().url()]).optional(),
  whatsappUrl: z.union([z.literal(""), z.string().trim().url()]).optional(),
  footerDescription: z.string().trim().max(300).optional(),
  footerAboutTitle: z.string().trim().max(80).optional(),
  footerAboutContent: z.string().trim().max(10000).optional(),
  footerHowItWorksTitle: z.string().trim().max(80).optional(),
  footerHowItWorksContent: z.string().trim().max(10000).optional(),
  footerTermsTitle: z.string().trim().max(80).optional(),
  footerTermsContent: z.string().trim().max(10000).optional(),
  footerPrivacyTitle: z.string().trim().max(80).optional(),
  footerPrivacyContent: z.string().trim().max(10000).optional(),
  footerHelpTitle: z.string().trim().max(80).optional(),
  footerHelpContent: z.string().trim().max(10000).optional(),
  footerFaqTitle: z.string().trim().max(80).optional(),
  footerFaqContent: z.string().trim().max(10000).optional(),
  footerContactTitle: z.string().trim().max(80).optional(),
  footerContactContent: z.string().trim().max(10000).optional(),
  defaultCurrency: z.string().trim().min(3).max(3).default("BRL"),
  platformFeePercent: z.coerce.number().min(0).max(30).default(0),
  orderReservationMinutes: z.coerce.number().int().min(15).max(1440).default(120),
  cardPendingReservationMinutes: z.coerce.number().int().min(5).max(240).default(30)
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
