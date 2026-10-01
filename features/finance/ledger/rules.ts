import { createHash } from "node:crypto";
import { z } from "zod";

// Direction is a property of the economic fact, never a caller-supplied sign.
export const RULES = {
  SALE_PRINCIPAL: ["PRODUCER", "CREDIT"],
  SERVICE_FEE: ["FEES", "CREDIT"],
  CARD_INTEREST: ["INTEREST", "CREDIT"],
  REFUND_PRINCIPAL: ["PRODUCER", "DEBIT"],
  REFUND_FEE: ["FEES", "DEBIT"],
  REFUND_INTEREST: ["INTEREST", "DEBIT"],
  BILHETERIA_WITHDRAWAL: ["ALLOCATION", "DEBIT"],
  PRODUCER_WITHDRAWAL: ["PRODUCER", "DEBIT"],
  ASAAS_FEE: ["COSTS", "DEBIT"],
  ASAAS_FEE_REVERSAL: ["COSTS", "CREDIT"],
  SPLIT: ["SPLITS", "DEBIT"],
  SPLIT_REVERSAL: ["SPLITS", "CREDIT"],
  RECEIVABLE_OPEN: ["RECEIVABLES", "CREDIT"],
  RECEIVABLE_SETTLED: ["RECEIVABLES", "DEBIT"],
  RECEIVABLE_REFUND: ["RECEIVABLES", "DEBIT"],
  CASH_RECEIPT: ["CASH", "CREDIT"],
  CASH_REFUND: ["CASH", "DEBIT"],
  CASH_WITHDRAWAL: ["CASH", "DEBIT"],
  CASH_FEE: ["CASH", "DEBIT"],
  CASH_FEE_REVERSAL: ["CASH", "CREDIT"],
  CASH_SPLIT: ["CASH", "DEBIT"],
  CASH_SPLIT_REVERSAL: ["CASH", "CREDIT"],
  CASH_ANTICIPATION_SETTLEMENT: ["CASH", "DEBIT"],
  CASH_TRANSFER_REVERSAL: ["CASH", "CREDIT"],
} as const;
export type EntryKind = keyof typeof RULES;
export const centsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const signedCentsSchema = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
export const entrySchema = z
  .object({
    sourceKey: z.string().min(1).max(250),
    type: z.enum(Object.keys(RULES) as [EntryKind, ...EntryKind[]]),
    amountInCents: centsSchema.positive(),
    effectiveDate: z.iso.date(),
    verified: z.boolean(),
    orderId: z.string().optional(),
    paymentId: z.string().optional(),
    externalPaymentId: z.string().optional(),
    transactionId: z.string().optional(),
    evidence: z.string().min(1).max(2000),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type EntryInput = z.input<typeof entrySchema>;
export function hash(value: unknown): string {
  const canonical = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(canonical)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : item;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export function sum(values: number[]) {
  const result = values.reduce(
    (a, b) => a + BigInt(signedCentsSchema.parse(b)),
    BigInt(0),
  );
  return signedCentsSchema.parse(Number(result));
}
export function money(value: unknown): number {
  const text = String(value);
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Invalid provider monetary amount");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  return signedCentsSchema.parse(
    Number(BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))) *
      (text.startsWith("-") ? -1 : 1),
  );
}
export function dateAtNoon(date: string) {
  return new Date(`${z.iso.date().parse(date)}T15:00:00.000Z`);
}
export function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function dayEnd(date: string) {
  return new Date(`${z.iso.date().parse(date)}T23:59:59.999-03:00`);
}
export function proportionalRefund(
  total: number,
  fee: number,
  interest: number,
  refunded: number,
) {
  [total, fee, interest, refunded].forEach((x) => centsSchema.parse(x));
  if (refunded > total || fee + interest > total)
    throw new Error("Invalid order/refund decomposition");
  // Cumulative allocation, so successive partial refunds conserve every cent.
  const rounded = (x: number) =>
    total
      ? Number(
          (BigInt(x) * BigInt(refunded) + BigInt(Math.floor(total / 2))) /
            BigInt(total),
        )
      : 0;
  const f = Math.min(rounded(fee), refunded);
  const i = Math.min(rounded(interest), refunded - f);
  return { principal: refunded - f - i, fee: f, interest: i };
}
