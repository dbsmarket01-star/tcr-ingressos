import { z } from "zod";
import { assertCents, sumCents } from "./financial-integrity";

const cents = z.number().int().refine(Number.isSafeInteger);
const evidence = z.string().trim().min(1);
const date = z.iso.date();
const signs = {
  SALE_PRINCIPAL: 1,
  REFUND_PRINCIPAL: -1,
  PRODUCER_TRANSFER: -1,
  ADJUSTMENT_CREDIT: 1,
  ADJUSTMENT_DEBIT: -1
} as const;

export const producerClosingSchema = z.object({
  organizationId: evidence,
  scope: evidence,
  startDate: date,
  endDate: date,
  opening: z.object({ amountInCents: cents, evidence, verified: z.boolean() }).strict(),
  // Evidence must document completeness of sales, refunds and transfers, not just their sums.
  sourceReconciliation: z.object({ verified: z.boolean(), evidence }).strict(),
  movements: z.array(z.object({
    sourceKey: evidence,
    effectiveDate: date,
    kind: z.enum(Object.keys(signs) as [keyof typeof signs, ...(keyof typeof signs)[]]),
    amountInCents: cents.positive(),
    evidence
  }).strict()),
  // A previously issued balance is checked, never used to calculate the next day.
  published: z.array(z.object({ date, balanceInCents: cents }).strict()).default([])
}).strict();

export type ProducerClosingInput = z.input<typeof producerClosingSchema>;

/** Producer entitlement by effective date; intentionally excludes bank cash and receivables. */
export function reconcileProducerClosing(input: unknown) {
  const data = producerClosingSchema.parse(input);
  if (data.startDate > data.endDate) throw new Error("Período de fechamento invertido.");
  const start = Date.parse(`${data.startDate}T00:00:00Z`);
  const end = Date.parse(`${data.endDate}T00:00:00Z`);
  if ((end - start) / 86400000 > 3660) throw new Error("Período máximo: 3661 dias.");
  const keys = new Set<string>();
  const movementsByDay = new Map<string, typeof data.movements>();
  for (const movement of data.movements) {
    if (keys.has(movement.sourceKey)) throw new Error(`Origem duplicada: ${movement.sourceKey}`);
    keys.add(movement.sourceKey);
    if (movement.effectiveDate < data.startDate || movement.effectiveDate > data.endDate) {
      throw new Error(`Movimento fora do período: ${movement.sourceKey}`);
    }
    const day = movementsByDay.get(movement.effectiveDate) ?? [];
    day.push(movement);
    movementsByDay.set(movement.effectiveDate, day);
  }
  const published = new Map<string, number>();
  for (const row of data.published) {
    if (published.has(row.date) || row.date < data.startDate || row.date > data.endDate) {
      throw new Error(`Fechamento publicado duplicado ou fora do período: ${row.date}`);
    }
    published.set(row.date, row.balanceInCents);
  }
  let balance = data.opening.amountInCents;
  const days = [];
  const issues: string[] = [];
  if (!data.opening.verified) issues.push("Saldo inicial sem comprovação reconciliada.");
  if (!data.sourceReconciliation.verified) issues.push("Completude dos movimentos ainda não reconciliada com as fontes.");
  for (let timestamp = start; timestamp <= end; timestamp += 86400000) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
    const movements = movementsByDay.get(date) ?? [];
    const creditInCents = sumCents(movements.filter(m => signs[m.kind] === 1).map(m => m.amountInCents));
    const debitInCents = sumCents(movements.filter(m => signs[m.kind] === -1).map(m => m.amountInCents));
    const openingInCents = balance;
    balance = sumCents([openingInCents, creditInCents, -debitInCents]);
    const publishedInCents = published.get(date) ?? null;
    const differenceInCents = publishedInCents === null ? null : sumCents([publishedInCents, -balance]);
    if (differenceInCents !== null && differenceInCents !== 0) issues.push(`Saldo publicado divergente: ${date}`);
    days.push({ date, openingInCents, creditInCents, debitInCents, balanceInCents: balance, publishedInCents, differenceInCents });
  }
  // Second path: one sum over the complete ledger, independent of daily carry.
  const ledgerBalance = sumCents([data.opening.amountInCents, ...data.movements.map(m => signs[m.kind] * m.amountInCents)]);
  assertCents(ledgerBalance, "saldo do razão", true);
  if (ledgerBalance !== balance) throw new Error("Transporte diário diverge do razão.");
  return {
    basis: "PRODUCER_ENTITLEMENT" as const,
    organizationId: data.organizationId,
    scope: data.scope,
    status: issues.length ? "BLOCKED" as const : "RECONCILED_INPUT" as const,
    issues,
    days,
    closingInCents: balance,
    // This result does not authorize a payout or certify a bank balance.
    bankReconciled: false as const
  };
}
