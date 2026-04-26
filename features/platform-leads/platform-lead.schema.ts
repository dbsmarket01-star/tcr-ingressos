import { z } from "zod";

export const platformLeadSchema = z.object({
  name: z.string().min(3, "Informe seu nome completo."),
  email: z.string().email("Informe um e-mail válido."),
  phone: z.string().min(10, "Informe um telefone com DDD."),
  annualRevenueBand: z.string().min(2, "Selecione a faixa de faturamento."),
  instagramHandle: z
    .string()
    .transform((value) => value.trim().replace(/^@+/, ""))
    .optional()
    .or(z.literal("")),
  eventNiche: z.string().min(3, "Informe o nicho principal dos seus eventos.")
});

export type PlatformLeadInput = z.infer<typeof platformLeadSchema>;
