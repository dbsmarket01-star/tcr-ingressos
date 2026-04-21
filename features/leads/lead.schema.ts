import { z } from "zod";

export const eventLeadSchema = z.object({
  eventId: z.string().min(1),
  eventSlug: z.string().min(3),
  name: z.string().min(3, "Informe seu nome completo."),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().min(8, "Informe um telefone com DDD.").optional()
});

export type EventLeadInput = z.infer<typeof eventLeadSchema>;
