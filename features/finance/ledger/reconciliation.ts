import { z } from "zod";
import {
  centsSchema,
  signedCentsSchema,
  sum,
  proportionalRefund,
  RULES,
  type EntryKind,
} from "./rules";
export const snapshotSchema = z.object({
  accountId: z.string().min(1),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  capturedAt: z.iso.datetime(),
  complete: z.boolean(),
  closingBalanceInCents: signedCentsSchema.nullable(),
  issues: z.array(z.string()),
  charges: z.array(
    z.object({
      id: z.string(),
      orderCode: z.string().nullable(),
      grossInCents: centsSchema,
      netInCents: centsSchema,
      paidDate: z.iso.date().nullable(),
      creditDate: z.iso.date().nullable(),
      status: z.string(),
      refunds: z.array(
        z.object({
          id: z.string(),
          amountInCents: centsSchema,
          date: z.iso.date().nullable(),
        }),
      ),
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      amountInCents: signedCentsSchema,
      date: z.iso.date(),
      paymentId: z.string().nullable(),
      splitId: z.string().nullable(),
    }),
  ),
});
export type FinancialSnapshot = z.infer<typeof snapshotSchema>;
export type FinancialOrder = {
  id: string;
  code: string;
  paidDate: string;
  totalInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
  refundedInCents: number;
};
export type LedgerFact = {
  orderId?: string | null;
  id?: string;
  reversalOfId?: string | null;
  transactionId?: string | null;
  type: string;
  account: string;
  direction: string;
  amountInCents: number;
  verified: boolean;
};
export const statementTypes: Record<string, EntryKind> = {
  PAYMENT_RECEIVED: "CASH_RECEIPT",
  RECEIVABLE_ANTICIPATION_GROSS_CREDIT: "CASH_RECEIPT",
  RECEIVABLE_ANTICIPATION_DEBIT: "CASH_ANTICIPATION_SETTLEMENT",
  PAYMENT_REVERSAL: "CASH_REFUND",
  PAYMENT_FEE: "CASH_FEE",
  RECEIVABLE_ANTICIPATION_FEE: "CASH_FEE",
  TRANSFER_FEE: "CASH_FEE",
  REFUND_REQUEST_FEE: "CASH_FEE",
  PAYMENT_FEE_REVERSAL: "CASH_FEE_REVERSAL",
  REFUND_REQUEST_FEE_REVERSAL: "CASH_FEE_REVERSAL",
  TRANSFER: "CASH_WITHDRAWAL",
  PIX_TRANSACTION_DEBIT: "CASH_WITHDRAWAL",
  TRANSFER_REVERSAL: "CASH_TRANSFER_REVERSAL",
};
export function statementKind(
  row: FinancialSnapshot["transactions"][number],
): EntryKind | undefined {
  if (row.splitId && row.type === "INTERNAL_TRANSFER_DEBIT")
    return "CASH_SPLIT";
  if (row.splitId && row.type === "INTERNAL_TRANSFER_REVERSAL")
    return "CASH_SPLIT_REVERSAL";
  return statementTypes[row.type];
}
export function chargeRefund(
  charge: FinancialSnapshot["charges"][number],
  endDate: string,
) {
  return sum(
    charge.refunds
      .filter((r) => r.date && r.date <= endDate)
      .map((r) => r.amountInCents),
  );
}
export function chargeOutstanding(
  charge: FinancialSnapshot["charges"][number],
  endDate: string,
) {
  if (!charge.paidDate || charge.paidDate > endDate) return 0;
  if (charge.creditDate && charge.creditDate <= endDate) return 0;
  return Math.max(0, charge.grossInCents - chargeRefund(charge, endDate));
}
export function evaluateReconciliation(input: {
  snapshot: FinancialSnapshot;
  orders: FinancialOrder[];
  entries: LedgerFact[];
  openingCashInCents: number;
  openingProducerInCents: number;
  openingReceivablesInCents: number;
}) {
  const { snapshot, orders, entries } = input;
  const reversedIds = new Set(
    entries.filter((e) => e.reversalOfId).map((e) => e.reversalOfId),
  );
  const activeEntries = entries.filter(
    (e) => e.type !== "REVERSAL" && !reversedIds.has(e.id),
  );
  const issues = [...snapshot.issues];
  const mismatches: Array<{
    kind: string;
    key: string;
    expected?: number;
    actual?: number;
  }> = [];
  const add = (
    kind: string,
    key: string,
    expected?: number,
    actual?: number,
  ) => {
    issues.push(`${kind}:${key}`);
    mismatches.push({ kind, key, expected, actual });
  };
  if (!snapshot.complete) add("INCOMPLETE_SOURCE", "asaas");
  for (const [name, rows] of [
    ["charge", snapshot.charges],
    ["transaction", snapshot.transactions],
  ] as const) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (ids.has(row.id)) add("DUPLICATE_SOURCE", `${name}:${row.id}`);
      ids.add(row.id);
    }
  }
  const actual = (account: string) =>
    sum(
      entries
        .filter((e) => e.account === account)
        .map((e) => e.amountInCents * (e.direction === "CREDIT" ? 1 : -1)),
    );
  if (activeEntries.some((e) => !e.verified)) add("UNVERIFIED_ENTRY", "ledger");
  const expected = {
    PRODUCER: input.openingProducerInCents,
    FEES: 0,
    INTEREST: 0,
    COSTS: 0,
    SPLITS: 0,
    CASH: input.openingCashInCents,
    RECEIVABLES: 0,
  };
  const allPaid = snapshot.charges.filter(
    (c) => c.paidDate && c.paidDate <= snapshot.endDate,
  );
  const paid = allPaid.filter((c) => c.paidDate! >= snapshot.startDate);
  const orderMap = new Map(orders.map((o) => [o.code, o]));
  for (const charge of allPaid) {
    // Legacy charges compose the opening receivables balance, but only charges
    // created inside the prospective ledger window must have a TCR order.
    // Applying this check to the entire provider history creates thousands of
    // false incidents for sales made before the ledger existed.
    if (
      charge.paidDate! >= snapshot.startDate &&
      (!charge.orderCode || !orderMap.has(charge.orderCode))
    )
      add("PAID_CHARGE_WITHOUT_ORDER", charge.id);
    if (charge.refunds.some((r) => !r.date))
      add("REFUND_DATE_MISSING", charge.id);
    if (chargeRefund(charge, snapshot.endDate) > charge.grossInCents)
      add("REFUND_EXCEEDS_CHARGE", charge.id);
    expected.RECEIVABLES = sum([
      expected.RECEIVABLES,
      chargeOutstanding(charge, snapshot.endDate),
    ]);
  }
  for (const order of orders.filter(
    (o) => o.paidDate >= snapshot.startDate && o.paidDate <= snapshot.endDate,
  )) {
    const charges = paid.filter((c) => c.orderCode === order.code);
    if (!charges.length) add("PAID_ORDER_WITHOUT_CHARGE", order.id);
    if (charges.some((c) => c.paidDate !== order.paidDate))
      add("PAYMENT_DATE_MISMATCH", order.id);
    const charged = sum(charges.map((c) => c.grossInCents));
    if (charged !== order.totalInCents)
      add("CHARGE_AMOUNT_MISMATCH", order.id, order.totalInCents, charged);
    const refunded = sum(charges.map((c) => chargeRefund(c, snapshot.endDate)));
    // Current TCR refund total is comparable only if no provider refund occurred after this cut.
    if (
      !charges.some((c) =>
        c.refunds.some((r) => !r.date || r.date > snapshot.endDate),
      ) &&
      refunded !== order.refundedInCents
    )
      add("REFUND_AMOUNT_MISMATCH", order.id, order.refundedInCents, refunded);
    if (
      refunded > order.totalInCents ||
      order.serviceFeeInCents + order.cardInterestInCents > order.totalInCents
    ) {
      add("INVALID_ORDER_AMOUNTS", order.id);
      continue;
    }
    const r = proportionalRefund(
      order.totalInCents,
      order.serviceFeeInCents,
      order.cardInterestInCents,
      refunded,
    );
    const orderExpectations = {
      PRODUCER:
        order.totalInCents -
        order.serviceFeeInCents -
        order.cardInterestInCents -
        r.principal,
      FEES: order.serviceFeeInCents - r.fee,
      INTEREST: order.cardInterestInCents - r.interest,
    };
    for (const [account, value] of Object.entries(orderExpectations)) {
      const recorded = sum(
        activeEntries
          .filter(
            (e) =>
              e.orderId === order.id &&
              e.account === account &&
              [
                "SALE_PRINCIPAL",
                "SERVICE_FEE",
                "CARD_INTEREST",
                "REFUND_PRINCIPAL",
                "REFUND_FEE",
                "REFUND_INTEREST",
              ].includes(e.type),
          )
          .map((e) => e.amountInCents * (e.direction === "CREDIT" ? 1 : -1)),
      );
      if (recorded !== value)
        add("ORDER_LEDGER_MISMATCH", `${order.id}:${account}`, value, recorded);
    }
    expected.PRODUCER = sum([
      expected.PRODUCER,
      order.totalInCents -
        order.serviceFeeInCents -
        order.cardInterestInCents -
        r.principal,
    ]);
    expected.FEES = sum([expected.FEES, order.serviceFeeInCents - r.fee]);
    expected.INTEREST = sum([
      expected.INTEREST,
      order.cardInterestInCents - r.interest,
    ]);
  }
  // Refunds of pre-opening sales need an explicitly reconciled opening/legacy adjustment.
  if (
    allPaid.some(
      (c) =>
        c.paidDate! < snapshot.startDate &&
        c.refunds.some(
          (r) =>
            r.date &&
            r.date >= snapshot.startDate &&
            r.date <= snapshot.endDate,
        ),
    )
  )
    add("LEGACY_REFUND_REQUIRES_REVIEW", "opening");
  for (const row of snapshot.transactions) {
    if (row.date < snapshot.startDate || row.date > snapshot.endDate) {
      add("TRANSACTION_OUTSIDE_PERIOD", row.id);
      continue;
    }
    const type = statementKind(row);
    if (!type) {
      add("UNCLASSIFIED_TRANSACTION", row.id);
      continue;
    }
    if (
      row.amountInCents === 0 ||
      Math.sign(row.amountInCents) !== (RULES[type][1] === "CREDIT" ? 1 : -1)
    ) {
      add("INVERTED_SIGN", row.id);
      continue;
    }
    if (type === "CASH_TRANSFER_REVERSAL")
      add("TRANSFER_REVERSAL_REQUIRES_REVIEW", row.id);
    if (row.type.startsWith("RECEIVABLE_ANTICIPATION"))
      add("ANTICIPATION_REQUIRES_REVIEW", row.id);
    expected.CASH = sum([expected.CASH, row.amountInCents]);
    if (type === "CASH_FEE" || type === "CASH_FEE_REVERSAL")
      expected.COSTS = sum([expected.COSTS, row.amountInCents]);
    if (type === "CASH_SPLIT" || type === "CASH_SPLIT_REVERSAL")
      expected.SPLITS = sum([expected.SPLITS, row.amountInCents]);
    if (type === "CASH_WITHDRAWAL") {
      const allocated = sum(
        activeEntries
          .filter(
            (e) =>
              e.transactionId === row.id &&
              ["PRODUCER_WITHDRAWAL", "BILHETERIA_WITHDRAWAL"].includes(e.type),
          )
          .map((e) => e.amountInCents),
      );
      if (allocated !== Math.abs(row.amountInCents))
        add(
          "WITHDRAWAL_ALLOCATION_REQUIRED",
          row.id,
          Math.abs(row.amountInCents),
          allocated,
        );
    }
  }
  // Allocation is separately evidenced; a bank withdrawal is not automatically producer money.
  expected.PRODUCER = sum([
    expected.PRODUCER,
    -sum(
      activeEntries
        .filter((e) => e.type === "PRODUCER_WITHDRAWAL")
        .map((e) => e.amountInCents),
    ),
  ]);
  const balances = {
    PRODUCER: sum([input.openingProducerInCents, actual("PRODUCER")]),
    FEES: actual("FEES"),
    INTEREST: actual("INTEREST"),
    COSTS: actual("COSTS"),
    SPLITS: actual("SPLITS"),
    CASH: sum([input.openingCashInCents, actual("CASH")]),
    RECEIVABLES: sum([input.openingReceivablesInCents, actual("RECEIVABLES")]),
  };
  const differences = Object.fromEntries(
    Object.keys(expected).map((k) => {
      const key = k as keyof typeof expected;
      return [key, sum([balances[key], -expected[key]])];
    }),
  );
  if (snapshot.closingBalanceInCents === null)
    add("BANK_BALANCE_MISSING", "asaas");
  else if (snapshot.closingBalanceInCents !== expected.CASH)
    add(
      "BANK_BALANCE_MISMATCH",
      "cash",
      snapshot.closingBalanceInCents,
      expected.CASH,
    );
  for (const [key, difference] of Object.entries(differences))
    if (difference !== 0)
      add(
        "LEDGER_DIFFERENCE",
        key,
        expected[key as keyof typeof expected],
        balances[key as keyof typeof balances],
      );
  const uncoveredPrincipalInCents = Math.max(
    0,
    balances.PRODUCER - (snapshot.closingBalanceInCents ?? 0),
  );
  if (uncoveredPrincipalInCents)
    add(
      "UNCOVERED_PRINCIPAL",
      "producer",
      balances.PRODUCER,
      snapshot.closingBalanceInCents ?? 0,
    );
  const differenceInCents = sum([
    ...Object.values(differences).map(Math.abs),
    Math.abs((snapshot.closingBalanceInCents ?? expected.CASH) - expected.CASH),
  ]);
  return {
    status:
      issues.length || differenceInCents
        ? ("BLOCKED" as const)
        : ("RECONCILED" as const),
    issues,
    mismatches,
    differenceInCents,
    expected,
    balances,
    differences,
    uncoveredPrincipalInCents,
  };
}
