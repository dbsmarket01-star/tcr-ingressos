import { z } from "zod";

export const splitRuleTypeSchema = z.enum(["PERCENTAGE", "FIXED_PER_ORDER", "FIXED_PER_TICKET"]);

export const splitRuleFormSchema = z.object({
  name: z.string().trim().max(80).optional(),
  walletId: z.string().trim().max(120).optional(),
  type: splitRuleTypeSchema.default("PERCENTAGE"),
  value: z.coerce.number().min(0).max(100000).default(0),
  isActive: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0)
});

export type SplitRuleFormInput = z.infer<typeof splitRuleFormSchema>;
