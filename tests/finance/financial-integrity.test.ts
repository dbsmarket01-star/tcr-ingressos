import { describe, expect, it } from "vitest";
import { validateFinanceReport } from "@/features/finance/financial-integrity";

function report() {
  const breakdown = { grossInCents: 12000, ticketNetInCents: 10000, serviceFeeInCents: 1500, cardInterestInCents: 500, count: 1 };
  return {
    paidOrders: [{ id: "order_1", totalInCents: 12000, ticketNetInCents: 10000, serviceFeeInCents: 1500, cardInterestInCents: 500 }],
    totals: { grossRevenueInCents: 12000, ticketNetInCents: 10000, serviceFeeInCents: 1500, cardInterestInCents: 500, paidOrders: 1 },
    byEvent: [{ ...breakdown }], byMethod: [{ ...breakdown }], bySource: [{ ...breakdown }]
  };
}

describe("finance report integrity", () => {
  it("accepts a balanced report", () => expect(validateFinanceReport(report())).toEqual({ valid: true, issues: [] }));
  it("blocks a one-cent aggregate difference", () => {
    const data = report(); data.totals.ticketNetInCents += 1;
    expect(validateFinanceReport(data).valid).toBe(false);
  });
  it("blocks a missing group row even when the global total is correct", () => {
    const data = report(); data.byEvent = [];
    expect(validateFinanceReport(data).issues).toContain("Agrupamento divergente: byEvent.grossInCents");
  });
  it("blocks duplicate orders", () => {
    const data = report(); data.paidOrders.push({ ...data.paidOrders[0] });
    expect(validateFinanceReport(data).issues).toContain("Pedido duplicado: order_1");
  });
  it("blocks fees exceeding the gross amount even if principal was clamped to zero", () => {
    const data = report(); data.paidOrders[0].serviceFeeInCents = 15000; data.paidOrders[0].ticketNetInCents = 0;
    expect(validateFinanceReport(data).issues).toContain("Principal + taxa + juros diferem do total: order_1");
  });
  it.each([NaN, Infinity, -1, 0.5])("blocks invalid monetary values %s", value => {
    const data = report(); data.paidOrders[0].totalInCents = value;
    expect(validateFinanceReport(data).valid).toBe(false);
  });
});
