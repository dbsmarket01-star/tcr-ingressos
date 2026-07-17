import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  event: {
    findFirst: vi.fn()
  },
  order: {
    findMany: vi.fn()
  }
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

function order(overrides: Record<string, unknown>) {
  return {
    id: "order_1",
    status: "PAID",
    discountInCents: 0,
    pixDiscountInCents: 0,
    payment: {
      status: "APPROVED",
      failureReason: null,
      rawPayload: null
    },
    items: [],
    ...overrides
  };
}

function item(overrides: Record<string, unknown>) {
  return {
    id: "item_1",
    lotId: "lot_1",
    lotOptionId: "option_1",
    quantity: 1,
    unitPriceInCents: 10000,
    totalInCents: 10000,
    serviceFeeInCents: 1000,
    lot: {
      id: "lot_1",
      name: "Cadeira Ouro"
    },
    lotOption: {
      id: "option_1",
      label: "Solidario"
    },
    ...overrides
  };
}

describe("event ticket sales report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.event.findFirst.mockResolvedValue({
      id: "event_1",
      title: "Show Teste",
      slug: "show-teste",
      startsAt: new Date("2026-09-25T21:00:00.000Z"),
      organization: {
        name: "TCR Ingressos"
      }
    });
    prismaMock.order.findMany.mockResolvedValue([]);
  });

  it("groups sold tickets by lot option and subtracts coupons and chargebacks from the total", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      order({
        id: "order_paid",
        discountInCents: 1000,
        items: [
          item({
            id: "item_paid",
            quantity: 2,
            totalInCents: 20000,
            serviceFeeInCents: 2000
          })
        ]
      }),
      order({
        id: "order_chargeback",
        status: "REFUNDED",
        payment: {
          status: "REFUNDED",
          failureReason: "PAYMENT_CHARGEBACK_REQUESTED",
          rawPayload: null
        },
        items: [
          item({
            id: "item_chargeback",
            quantity: 1,
            totalInCents: 10000,
            serviceFeeInCents: 1000
          })
        ]
      })
    ]);

    const { getEventTicketSalesReport } = await import("@/features/reports/event-ticket-sales-report.service");
    const report = await getEventTicketSalesReport("org_tcr", "event_1");

    expect(report?.rows).toHaveLength(1);
    expect(report?.rows[0]).toMatchObject({
      ticketName: "Cadeira Ouro - Solidario",
      ticketType: "Online",
      unitPriceInCents: 10000,
      quantity: 3,
      ticketRevenueInCents: 30000,
      serviceFeeInCents: 3000,
      couponDiscountInCents: 1000,
      chargebackInCents: 11000,
      refundInCents: 0,
      totalInCents: 21000
    });
    expect(report?.totals.totalInCents).toBe(21000);
  });

  it("does not load an event outside the admin event scope", async () => {
    const { getEventTicketSalesReport } = await import("@/features/reports/event-ticket-sales-report.service");
    const report = await getEventTicketSalesReport("org_tcr", "event_1", ["event_2"]);

    expect(report).toBeNull();
    expect(prismaMock.event.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });
});
