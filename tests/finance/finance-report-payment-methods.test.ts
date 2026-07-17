import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  event: {
    findMany: vi.fn()
  },
  ticketLot: {
    findMany: vi.fn()
  },
  order: {
    findMany: vi.fn()
  }
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/features/tracking/tracking", () => ({
  getSourceLabel: vi.fn(() => "Direto")
}));

vi.mock("@/features/payments/split-report.service", () => ({
  summarizeAsaasSplit: vi.fn(() => ({
    entries: [],
    totalInCents: 0
  }))
}));

function paidOrder(overrides: Record<string, unknown>) {
  return {
    id: "order_1",
    code: "ING-1",
    status: "PAID",
    createdAt: new Date("2026-05-12T12:00:00.000Z"),
    paidAt: new Date("2026-05-12T12:05:00.000Z"),
    totalInCents: 2500,
    subtotalInCents: 2500,
    serviceFeeInCents: 0,
    cardInterestInCents: 0,
    discountInCents: 0,
    utmSource: null,
    utmMedium: null,
    event: {
      id: "event_1",
      title: "A2 Imergidos Gramado"
    },
    customer: {
      name: "Buyer",
      email: "buyer@example.com"
    },
    items: [],
    tickets: [{ id: "ticket_1", status: "ACTIVE" }],
    ...overrides
  };
}

describe("finance report payment methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.event.findMany.mockResolvedValue([]);
    prismaMock.ticketLot.findMany.mockResolvedValue([]);
  });

  it("keeps Pix and credit card revenue separated in financial reports", async () => {
    prismaMock.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        paidOrder({
          id: "order_pix",
          code: "ING-PIX",
          totalInCents: 2925,
          subtotalInCents: 2500,
          serviceFeeInCents: 425,
          payment: {
            provider: "ASAAS",
            status: "APPROVED",
            pixQrCodePayload: "000201",
            rawPayload: {
              payment: {
                id: "pay_pix",
                billingType: "PIX",
                netValue: 24.5
              }
            }
          }
        }),
        paidOrder({
          id: "order_card",
          code: "ING-CARD",
          totalInCents: 5850,
          subtotalInCents: 5000,
          serviceFeeInCents: 850,
          payment: {
            provider: "ASAAS",
            status: "APPROVED",
            pixQrCodePayload: null,
            rawPayload: {
              id: "pay_card",
              billingType: "CREDIT_CARD",
              netValue: 48.5
            }
          }
        })
      ]);

    const { getFinanceReport } = await import("@/features/finance/finance-report.service");
    const report = await getFinanceReport(
      {
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      },
      "org_a2"
    );

    const pix = report.byMethod.find((row) => row.method === "PIX");
    const card = report.byMethod.find((row) => row.method === "CREDIT_CARD");

    expect(pix?.count).toBe(1);
    expect(pix?.grossInCents).toBe(2925);
    expect(card?.count).toBe(1);
    expect(card?.grossInCents).toBe(5850);
    expect(report.totals.ticketSubtotalInCents).toBe(7500);
    expect(report.totals.serviceFeeInCents).toBe(1275);
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org_a2" }
    }));
    expect(prismaMock.ticketLot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { event: { organizationId: "org_a2" } }
    }));
    expect(prismaMock.order.findMany.mock.calls[0]?.[0].where.event).toEqual({ organizationId: "org_a2" });
    expect(prismaMock.order.findMany.mock.calls[1]?.[0].where.event).toEqual({ organizationId: "org_a2" });
  });

  it("applies lot and payment method filters without changing tenant scope", async () => {
    prismaMock.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        paidOrder({
          id: "order_pix",
          code: "ING-PIX",
          totalInCents: 2925,
          items: [{ lotId: "lot_1", lot: { id: "lot_1", name: "Cadeira Ouro" }, lotOption: null }],
          payment: {
            provider: "ASAAS",
            status: "APPROVED",
            pixQrCodePayload: "000201",
            rawPayload: { payment: { billingType: "PIX" } }
          }
        }),
        paidOrder({
          id: "order_card",
          code: "ING-CARD",
          totalInCents: 5850,
          items: [{ lotId: "lot_1", lot: { id: "lot_1", name: "Cadeira Ouro" }, lotOption: null }],
          payment: {
            provider: "ASAAS",
            status: "APPROVED",
            pixQrCodePayload: null,
            rawPayload: { billingType: "CREDIT_CARD" }
          }
        })
      ]);

    const { getFinanceReport } = await import("@/features/finance/finance-report.service");
    const report = await getFinanceReport(
      {
        lotId: "lot_1",
        paymentMethod: "PIX",
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      },
      "org_a2"
    );

    expect(report.filters.lotId).toBe("lot_1");
    expect(report.filters.paymentMethod).toBe("PIX");
    expect(report.totals.paidOrders).toBe(1);
    expect(report.byMethod).toHaveLength(1);
    expect(report.byMethod[0]?.method).toBe("PIX");
    expect(prismaMock.order.findMany.mock.calls[0]?.[0].where.items).toEqual({ some: { lotId: "lot_1" } });
    expect(prismaMock.order.findMany.mock.calls[1]?.[0].where.items).toEqual({ some: { lotId: "lot_1" } });
  });

  it("keeps the complete paid order history available for the filtered period", async () => {
    const paidOrders = Array.from({ length: 13 }, (_, index) => paidOrder({
      id: `order_${index + 1}`,
      code: `ING-${index + 1}`,
      paidAt: new Date(`2026-05-${String(index + 1).padStart(2, "0")}T12:05:00.000Z`),
      payment: {
        provider: "ASAAS",
        status: "APPROVED",
        pixQrCodePayload: "000201",
        rawPayload: {
          payment: {
            id: `pay_${index + 1}`,
            billingType: "PIX",
            netValue: 25
          }
        }
      }
    }));

    prismaMock.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(paidOrders);

    const { getFinanceReport } = await import("@/features/finance/finance-report.service");
    const report = await getFinanceReport(
      {
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      },
      "org_a2"
    );

    expect(report.totals.paidOrders).toBe(13);
    expect(report.paidOrders).toHaveLength(13);
    expect(report.recentPaidOrders).toHaveLength(12);
  });
});
