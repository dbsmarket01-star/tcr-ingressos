import { describe, it, expect } from "vitest";
import {
  evaluateReconciliation,
  type FinancialSnapshot,
  type LedgerFact,
} from "@/features/finance/ledger/reconciliation";
import {
  RULES,
  money,
  entrySchema,
  proportionalRefund,
  type EntryKind,
} from "@/features/finance/ledger/rules";
function entry(
  type: EntryKind,
  amountInCents: number,
  extra: Partial<LedgerFact> = {},
): LedgerFact {
  const [account, direction] = RULES[type];
  return {
    type,
    orderId: "order",
    account,
    direction,
    amountInCents,
    verified: true,
    ...extra,
  };
}
function fixture() {
  const snapshot: FinancialSnapshot = {
    accountId: "wallet",
    startDate: "2026-09-01",
    endDate: "2026-09-24",
    capturedAt: "2026-09-25T12:00:00Z",
    complete: true,
    closingBalanceInCents: 11700,
    issues: [],
    charges: [
      {
        id: "charge",
        orderCode: "A",
        grossInCents: 12000,
        netInCents: 11800,
        paidDate: "2026-09-24",
        creditDate: "2026-09-24",
        status: "RECEIVED",
        refunds: [],
      },
    ],
    transactions: [
      {
        id: "receipt",
        type: "PAYMENT_RECEIVED",
        amountInCents: 12000,
        date: "2026-09-24",
        paymentId: "charge",
        splitId: null,
      },
      {
        id: "fee",
        type: "PAYMENT_FEE",
        amountInCents: -200,
        date: "2026-09-24",
        paymentId: "charge",
        splitId: null,
      },
      {
        id: "split",
        type: "INTERNAL_TRANSFER_DEBIT",
        amountInCents: -100,
        date: "2026-09-24",
        paymentId: "charge",
        splitId: "split",
      },
    ],
  };
  return {
    snapshot,
    orders: [
      {
        id: "order",
        code: "A",
        paidDate: "2026-09-24",
        totalInCents: 12000,
        serviceFeeInCents: 1500,
        cardInterestInCents: 500,
        refundedInCents: 0,
      },
    ],
    entries: [
      entry("SALE_PRINCIPAL", 10000),
      entry("SERVICE_FEE", 1500),
      entry("CARD_INTEREST", 500),
      entry("CASH_RECEIPT", 12000),
      entry("CASH_FEE", 200),
      entry("ASAAS_FEE", 200),
      entry("CASH_SPLIT", 100),
      entry("SPLIT", 100),
      entry("RECEIVABLE_OPEN", 12000),
      entry("RECEIVABLE_SETTLED", 12000),
    ],
    openingCashInCents: 0,
    openingProducerInCents: 0,
    openingReceivablesInCents: 0,
  };
}
describe("financial reconciliation", () => {
  it("separates principal, fees, interest, costs, splits and cash exactly", () => {
    const r = evaluateReconciliation(fixture());
    expect(r.status).toBe("RECONCILED");
    expect(r.balances).toEqual({
      PRODUCER: 10000,
      FEES: 1500,
      INTEREST: 500,
      CASH: 11700,
      COSTS: -200,
      SPLITS: -100,
      RECEIVABLES: 0,
    });
  });
  it("does not let aggregate totals conceal wrong order ownership", () => {
    const f = fixture();
    f.entries[0].orderId = "another-order";
    const r = evaluateReconciliation(f);
    expect(r.differences.PRODUCER).toBe(0);
    expect(r.issues).toContain("ORDER_LEDGER_MISMATCH:order:PRODUCER");
    expect(r.status).toBe("BLOCKED");
  });
  it("blocks a single cent", () => {
    const f = fixture();
    f.snapshot.closingBalanceInCents!--;
    const r = evaluateReconciliation(f);
    expect(r.status).toBe("BLOCKED");
    expect(r.differenceInCents).toBe(1);
  });
  it("rejects the inverted credit sign", () => {
    const f = fixture();
    f.snapshot.transactions[0].amountInCents = -758810;
    expect(evaluateReconciliation(f).issues).toContain("INVERTED_SIGN:receipt");
  });
  it("blocks duplicate provider IDs", () => {
    const f = fixture();
    f.snapshot.charges.push(f.snapshot.charges[0]);
    expect(evaluateReconciliation(f).issues).toContain(
      "DUPLICATE_SOURCE:charge:charge",
    );
  });
  it("finds both unmatched sides", () => {
    const f = fixture();
    f.snapshot.charges[0].orderCode = "OTHER";
    const r = evaluateReconciliation(f);
    expect(r.issues).toContain("PAID_CHARGE_WITHOUT_ORDER:charge");
    expect(r.issues).toContain("PAID_ORDER_WITHOUT_CHARGE:order");
  });
  it("detects dates that shift a daily closing", () => {
    const f = fixture();
    f.snapshot.charges[0].paidDate = "2026-09-23";
    expect(evaluateReconciliation(f).issues).toContain(
      "PAYMENT_DATE_MISMATCH:order",
    );
  });
  it("does not guess unknown movements or historical balance", () => {
    const f = fixture();
    f.snapshot.transactions[0].type = "NEW_ASAAS_TYPE";
    f.snapshot.closingBalanceInCents = null;
    const r = evaluateReconciliation(f);
    expect(r.issues).toContain("UNCLASSIFIED_TRANSACTION:receipt");
    expect(r.issues).toContain("BANK_BALANCE_MISSING:asaas");
  });
  it("requires withdrawal allocation for the specific transaction", () => {
    const f = fixture();
    f.snapshot.transactions.push({
      id: "withdrawal",
      type: "TRANSFER",
      amountInCents: -100,
      date: "2026-09-24",
      paymentId: null,
      splitId: null,
    });
    f.entries.push(
      entry("CASH_WITHDRAWAL", 100),
      entry("BILHETERIA_WITHDRAWAL", 100, { transactionId: "wrong" }),
    );
    f.snapshot.closingBalanceInCents = 11600;
    expect(evaluateReconciliation(f).issues).toContain(
      "WITHDRAWAL_ALLOCATION_REQUIRED:withdrawal",
    );
    f.entries.at(-1)!.transactionId = "withdrawal";
    expect(evaluateReconciliation(f).status).toBe("RECONCILED");
  });
  it("allows a verified correction while retaining original history", () => {
    const f = fixture();
    f.entries[0].id = "original";
    f.entries[0].verified = false;
    f.entries.push(
      {
        ...f.entries[0],
        id: "reversal",
        type: "REVERSAL",
        direction: "DEBIT",
        verified: true,
        reversalOfId: "original",
      },
      entry("SALE_PRINCIPAL", 10000, { id: "corrected" }),
    );
    expect(evaluateReconciliation(f).status).toBe("RECONCILED");
  });
  it("separates receivables and blocks uncovered producer principal", () => {
    const f = fixture();
    f.snapshot.charges[0].creditDate = null;
    f.snapshot.transactions = [];
    f.snapshot.closingBalanceInCents = 0;
    f.entries = f.entries.filter((e) =>
      [
        "SALE_PRINCIPAL",
        "SERVICE_FEE",
        "CARD_INTEREST",
        "RECEIVABLE_OPEN",
      ].includes(e.type),
    );
    const r = evaluateReconciliation(f);
    expect(r.balances.RECEIVABLES).toBe(12000);
    expect(r.uncoveredPrincipalInCents).toBe(10000);
    expect(r.status).toBe("BLOCKED");
  });
  it("reconciles partial refunds without counting them twice", () => {
    const f = fixture();
    f.snapshot.charges[0].refunds = [
      { id: "refund", amountInCents: 1200, date: "2026-09-24" },
    ];
    f.orders[0].refundedInCents = 1200;
    f.snapshot.transactions.push({
      id: "refund",
      type: "PAYMENT_REVERSAL",
      amountInCents: -1200,
      date: "2026-09-24",
      paymentId: "charge",
      splitId: null,
    });
    f.snapshot.closingBalanceInCents = 10500;
    f.entries.push(
      entry("CASH_REFUND", 1200),
      entry("REFUND_PRINCIPAL", 1000),
      entry("REFUND_FEE", 150),
      entry("REFUND_INTEREST", 50),
    );
    expect(evaluateReconciliation(f).status).toBe("RECONCILED");
  });
  it("parses decimals exactly and rejects ambiguous precision", () => {
    expect(money("7588.10")).toBe(758810);
    expect(money("-0.01")).toBe(-1);
    expect(() => money("1.001")).toThrow();
  });
  it("conserves every cent when allocating partial refunds", () => {
    for (let n = 0; n <= 101; n++) {
      const r = proportionalRefund(101, 13, 7, n);
      expect(r.principal + r.fee + r.interest).toBe(n);
    }
  });
  it("rejects zero, negative and fractional ledger entries", () => {
    for (const amountInCents of [0, -1, 0.1])
      expect(() =>
        entrySchema.parse({
          sourceKey: "x",
          type: "SALE_PRINCIPAL",
          amountInCents,
          effectiveDate: "2026-09-24",
          verified: true,
          evidence: "order",
        }),
      ).toThrow();
  });
});
