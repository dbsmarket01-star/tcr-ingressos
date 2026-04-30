import { z } from "zod";

export const eventLeadSchema = z.object({
  eventId: z.string().min(1),
  eventSlug: z.string().min(3),
  name: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  phone: z.string().min(8, "Informe um telefone com DDD.").optional(),
  municipality: z.string().trim().min(2, "Informe seu município.").max(120).optional(),
  utmSource: z.string().max(240).optional(),
  utmMedium: z.string().max(240).optional(),
  utmCampaign: z.string().max(240).optional(),
  utmContent: z.string().max(240).optional(),
  utmTerm: z.string().max(240).optional(),
  referrer: z.string().max(240).optional(),
  landingPage: z.string().max(500).optional()
});

export type EventLeadInput = z.infer<typeof eventLeadSchema>;
