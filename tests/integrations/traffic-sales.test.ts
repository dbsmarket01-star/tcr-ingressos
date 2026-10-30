import { describe, expect, it } from "vitest";
import { aggregateTrafficSales, validateTrafficSalesFilters } from "@/features/integrations/traffic-sales.service";

const event = {
  id: "event-1", slug: "evento-teste", title: "Evento teste", city: "Sorocaba",
  state: "SP", venueName: "Local teste", startsAt: new Date("2026-11-30T21:00:00-03:00")
};

describe("traffic sales", () => {
  it("rejects malformed dates and overly broad periods", () => {
    expect(validateTrafficSalesFilters({ startDate: "2026-13-01", endDate: "2026-10-30" })).toBeTruthy();
    expect(validateTrafficSalesFilters({ startDate: "2026-10-31", endDate: "2026-10-30" })).toBeTruthy();
    expect(validateTrafficSalesFilters({ startDate: "2025-01-01", endDate: "2026-10-30" })).toBeTruthy();
    expect(validateTrafficSalesFilters({ startDate: "2026-10-28", endDate: "2026-10-30" })).toBeNull();
  });

  it("groups paid orders by local day and event, counting admissions and refunds", () => {
    const rows = aggregateTrafficSales([
      {
        paidAt: new Date("2026-10-29T01:00:00Z"), createdAt: new Date("2026-10-28T20:00:00Z"),
        event, items: [{ quantity: 2, admissionsPerUnit: 2 }], tickets: [],
        totalInCents: 40000, subtotalInCents: 32000, serviceFeeInCents: 7000,
        cardInterestInCents: 1000, discountInCents: 0, pixDiscountInCents: 0, refundedInCents: 10000
      },
      {
        paidAt: new Date("2026-10-29T01:30:00Z"), createdAt: new Date("2026-10-28T20:30:00Z"),
        event, items: [], tickets: [{ id: "ticket-1" }],
        totalInCents: 10000, subtotalInCents: 8000, serviceFeeInCents: 2000,
        cardInterestInCents: 0, discountInCents: 0, pixDiscountInCents: 0, refundedInCents: 0
      }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: "2026-10-28", paidOrders: 2, tickets: 5,
      ticketSalesInCents: 32000, serviceFeesInCents: 7250, cardInterestInCents: 750,
      totalPaidInCents: 40000, refundedInCents: 10000 });
  });
});
