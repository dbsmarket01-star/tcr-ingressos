import { z } from "zod";

export const creditCardPaymentSchema = z.object({
  orderCode: z.string().min(1),
  holderName: z.string().min(3),
  number: z.string().regex(/^\d{13,19}$/),
  expiryMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/),
  expiryYear: z.string().regex(/^(\d{2}|\d{4})$/),
  ccv: z.string().regex(/^\d{3,4}$/),
  holderCpfCnpj: z.string().regex(/^\d{11,14}$/),
  holderPostalCode: z.string().regex(/^\d{8}$/),
  holderAddressNumber: z.string().min(1),
  holderAddressComplement: z.string().optional(),
  installments: z.coerce.number().int().min(1).max(12).default(1)
});

export type CreditCardPaymentInput = z.infer<typeof creditCardPaymentSchema>;
