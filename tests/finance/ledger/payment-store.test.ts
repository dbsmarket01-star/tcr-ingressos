import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { appendEntry, type Tx } from "@/features/finance/ledger/store";
import { recordOrderFinancialState } from "@/features/finance/ledger/payment-ledger";
const entries = new Map<string, any>();
const order: any = {
  id: "order",
  code: "A",
  paidAt: new Date("2026-09-24T15:00:00Z"),
  totalInCents: 12000,
  serviceFeeInCents: 1500,
  cardInterestInCents: 500,
  refundedInCents: 0,
  event: { organizationId: "org" },
  payment: {
    id: "payment",
    provider: "ASAAS",
    externalId: "charge",
    rawPayload: null,
  },
};
const tx = {
  $queryRaw: vi.fn(async () => [{ organizationId: "org" }]),
  order: { findUnique: vi.fn(async () => order) },
  financialLedgerAccount: {
    findUnique: vi.fn(async () => ({ startsOn: new Date("2026-09-01") })),
  },
  financialLedgerEntry: {
    createMany: vi.fn(async ({ data }: any) => {
      const row = data[0],
        key = row.sourceKey;
      if (entries.has(key)) return { count: 0 };
      entries.set(key, row);
      return { count: 1 };
    }),
    findUniqueOrThrow: vi.fn(async ({ where }: any) =>
      entries.get(where.organizationId_sourceKey.sourceKey),
    ),
    findMany: vi.fn(async () =>
      [...entries.values()].filter((e) => e.type.startsWith("REFUND_")),
    ),
  },
  financialLedgerAudit: { create: vi.fn(async () => ({})) },
  financialIncident: { upsert: vi.fn(async () => ({})) },
};
beforeEach(() => {
  entries.clear();
  vi.clearAllMocks();
  order.refundedInCents = 0;
  order.payment.rawPayload = null;
});
describe("payment ledger transaction and source idempotency", () => {
  it("deduplicates concurrent append and audits the winner once", async () => {
    const input = {
      sourceKey: "source",
      type: "SALE_PRINCIPAL" as const,
      amountInCents: 100,
      effectiveDate: "2026-09-24",
      verified: true,
      evidence: "order",
    };
    await Promise.all([
      appendEntry(tx as unknown as Tx, "org", input),
      appendEntry(tx as unknown as Tx, "org", input),
    ]);
    expect(entries.size).toBe(1);
    expect(tx.financialLedgerAudit.create).toHaveBeenCalledTimes(1);
  });
  it("retains original and persists incident on conflicting retry", async () => {
    const input = {
      sourceKey: "source",
      type: "SALE_PRINCIPAL" as const,
      amountInCents: 100,
      effectiveDate: "2026-09-24",
      verified: true,
      evidence: "order",
    };
    await appendEntry(tx as unknown as Tx, "org", input);
    const result = await appendEntry(tx as unknown as Tx, "org", {
      ...input,
      amountInCents: 101,
    });
    expect(result.conflict).toBe(true);
    expect(entries.get("source").amountInCents).toBe(BigInt(100));
    expect(tx.financialIncident.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ kind: "DUPLICATE_SOURCE_CONFLICT" }),
      }),
    );
  });
  it("records approval once inside the supplied transaction", async () => {
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    expect(entries.size).toBe(4);
    expect(entries.get("order:order:SALE_PRINCIPAL").amountInCents).toBe(
      BigInt(10000),
    );
    expect(tx.financialLedgerAudit.create).toHaveBeenCalledTimes(4);
  });
  it("records only incremental refund amounts across retries", async () => {
    order.refundedInCents = 1200;
    order.payment.rawPayload = {
      payment: { refunds: [{ status: "DONE", dateCreated: "2026-09-24" }] },
    };
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    order.refundedInCents = 2400;
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    const refunds = [...entries.values()].filter((e) =>
      e.type.startsWith("REFUND_"),
    );
    expect(refunds).toHaveLength(6);
    expect(refunds.reduce((n, e) => n + e.amountInCents, BigInt(0))).toBe(
      BigInt(2400),
    );
  });
  it("does not create a missing-date incident for a refund retry without new money", async () => {
    order.refundedInCents = 1200;
    order.payment.rawPayload = {
      refunds: [{ status: "DONE", dateCreated: "2026-09-24" }],
    };
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    order.payment.rawPayload = null;
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    expect(tx.financialIncident.upsert).not.toHaveBeenCalled();
    expect(entries.size).toBe(7);
  });
  it("blocks ambiguous refund dates instead of silently choosing one", async () => {
    order.refundedInCents = 2400;
    order.payment.rawPayload = {
      refunds: [
        { status: "DONE", dateCreated: "2026-09-23" },
        { status: "DONE", dateCreated: "2026-09-24" },
      ],
    };
    await recordOrderFinancialState(tx as unknown as Tx, "order");
    expect(
      [...entries.values()]
        .filter((e) => e.type.startsWith("REFUND_"))
        .every((e) => !e.verified),
    ).toBe(true);
    expect(tx.financialIncident.upsert).toHaveBeenCalled();
  });
});
