import { describe, expect, it } from "vitest";
import { reconcileProducerClosing, type ProducerClosingInput } from "@/features/finance/producer-closing";

function input(): ProducerClosingInput {
  return {
    organizationId: "org_test",
    scope: "Fixture de teste",
    startDate: "2026-09-24",
    endDate: "2026-09-26",
    opening: { amountInCents: 1484203, verified: true, evidence: "Saldo de teste" },
    sourceReconciliation: { verified: true, evidence: "Movimentos de teste" },
    movements: [{ sourceKey: "sales:2026-09-24", effectiveDate: "2026-09-24", kind: "SALE_PRINCIPAL", amountInCents: 758810, evidence: "Entradas do dia" }],
    published: []
  };
}

describe("producer closing safety", () => {
  it("reproduces the September 24 sign error and carries the calculated balance forward", () => {
    const data = input();
    data.published = [
      { date: "2026-09-24", balanceInCents: 725393 },
      { date: "2026-09-25", balanceInCents: 1344463 }
    ];
    data.movements.push({ sourceKey: "sales:25", effectiveDate: "2026-09-25", kind: "SALE_PRINCIPAL", amountInCents: 619070, evidence: "Entradas 25" });
    const result = reconcileProducerClosing(data);
    expect(result.status).toBe("BLOCKED");
    expect(result.days[0]).toMatchObject({ balanceInCents: 2243013, differenceInCents: -1517620 });
    expect(result.days[1]).toMatchObject({ openingInCents: 2243013, balanceInCents: 2862083, differenceInCents: -1517620 });
    expect(result.days[2]).toMatchObject({ openingInCents: 2862083, balanceInCents: 2862083 });
  });

  it("deducts refunds and transfers on their effective day even with out-of-order input", () => {
    const data = input();
    data.movements.unshift({ sourceKey: "refund:1", effectiveDate: "2026-09-26", kind: "REFUND_PRINCIPAL", amountInCents: 36160, evidence: "Estorno" });
    data.movements.push({ sourceKey: "transfer:1", effectiveDate: "2026-09-25", kind: "PRODUCER_TRANSFER", amountInCents: 200000, evidence: "Repasse" });
    const result = reconcileProducerClosing(data);
    expect(result.days.map(day => day.balanceInCents)).toEqual([2243013, 2043013, 2006853]);
    expect(result.status).toBe("RECONCILED_INPUT");
    expect(result.bankReconciled).toBe(false);
  });

  it("rejects repeated source keys, including conflicting duplicates", () => {
    const data = input();
    data.movements.push({ ...data.movements[0] });
    expect(() => reconcileProducerClosing(data)).toThrow("Origem duplicada");
    data.movements[1].amountInCents += 1;
    expect(() => reconcileProducerClosing(data)).toThrow("Origem duplicada");
  });

  it.each([-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects an invalid movement amount %s", amountInCents => {
    const data = input();
    data.movements[0].amountInCents = amountInCents;
    expect(() => reconcileProducerClosing(data)).toThrow();
  });

  it("rejects overflow instead of losing cents", () => {
    const data = input();
    data.opening.amountInCents = Number.MAX_SAFE_INTEGER;
    expect(() => reconcileProducerClosing(data)).toThrow("soma");
  });

  it("allows a negative opening, but blocks unproven opening or incomplete sources", () => {
    const data = input();
    data.opening = { amountInCents: -302967, verified: false, evidence: "Saldo transportado sem origem" };
    data.sourceReconciliation.verified = false;
    const result = reconcileProducerClosing(data);
    expect(result.status).toBe("BLOCKED");
    expect(result.issues).toHaveLength(2);
    expect(result.closingInCents).toBe(455843);
  });

  it("does not accept bank cash, an arbitrary sign, invalid dates or out-of-period entries", () => {
    const data = input();
    expect(() => reconcileProducerClosing({ ...data, bankBalanceInCents: 100 })).toThrow();
    expect(() => reconcileProducerClosing({ ...data, movements: [{ ...data.movements[0], sign: -1 }] })).toThrow();
    expect(() => reconcileProducerClosing({ ...data, startDate: "2026-02-30" })).toThrow();
    data.movements[0].effectiveDate = "2026-09-23";
    expect(() => reconcileProducerClosing(data)).toThrow("fora do período");
  });

  it("requires unique published dates and rejects a reversed range", () => {
    const data = input();
    data.published = [{ date: "2026-09-24", balanceInCents: 2243013 }, { date: "2026-09-24", balanceInCents: 2243013 }];
    expect(() => reconcileProducerClosing(data)).toThrow("duplicado");
    expect(() => reconcileProducerClosing({ ...input(), endDate: "2026-09-23" })).toThrow("invertido");
  });
});
