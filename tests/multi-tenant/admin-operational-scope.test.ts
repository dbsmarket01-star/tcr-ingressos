import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  order: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn()
  },
  event: {
    findMany: vi.fn()
  },
  ticket: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn()
  },
  checkIn: {
    findMany: vi.fn(),
    count: vi.fn()
  }
};

const expirePendingOrdersMock = vi.fn(async () => ({ expiredCount: 0, releasedQuantity: 0 }));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/features/orders/order.service", () => ({
  expirePendingOrders: expirePendingOrdersMock
}));

vi.mock("@/features/email/email.service", () => ({
  createPublicOrderUrl: vi.fn(),
  createPublicTicketUrl: vi.fn(),
  sendOrderPendingPaymentEmail: vi.fn(),
  sendTicketsEmail: vi.fn()
}));

function mockEmptyResults() {
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.order.groupBy.mockResolvedValue([]);
  prismaMock.order.aggregate.mockResolvedValue({
    _sum: {
      totalInCents: 0,
      serviceFeeInCents: 0,
      cardInterestInCents: 0,
      discountInCents: 0
    }
  });
  prismaMock.event.findMany.mockResolvedValue([]);
  prismaMock.ticket.findMany.mockResolvedValue([]);
  prismaMock.ticket.count.mockResolvedValue(0);
  prismaMock.ticket.groupBy.mockResolvedValue([]);
  prismaMock.checkIn.findMany.mockResolvedValue([]);
  prismaMock.checkIn.count.mockResolvedValue(0);
}

describe("admin operational tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmptyResults();
  });

  it("scopes admin orders and event filters to the current organization", async () => {
    const { listAdminOrders, listOrderFilterEventsForOrganization } = await import(
      "@/features/orders/order.admin.service"
    );

    await listAdminOrders({}, "org_a2", null);
    await listOrderFilterEventsForOrganization("org_a2", null);

    const eventScope = {
      organizationId: "org_a2",
      status: {
        not: "DRAFT"
      }
    };

    expect(expirePendingOrdersMock).toHaveBeenCalledWith({
      limit: 100,
      organizationId: "org_a2",
      allowedEventIds: null
    });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eventScope
      })
    );
  });

  it("excludes pending order attempts after the customer paid for the same event", async () => {
    const { getOrdersSummary, listAdminOrders } = await import("@/features/orders/order.admin.service");

    prismaMock.order.findMany
      .mockResolvedValueOnce([
        { id: "pending_converted", customerId: "customer_1", eventId: "event_1" },
        { id: "pending_open", customerId: "customer_2", eventId: "event_1" }
      ])
      .mockResolvedValueOnce([{ customerId: "customer_1", eventId: "event_1" }]);
    prismaMock.order.groupBy.mockResolvedValue([{ status: "PENDING_PAYMENT", _count: { _all: 1 } }]);
    prismaMock.order.aggregate.mockResolvedValue({
      _sum: {
        totalInCents: 27580,
        subtotalInCents: 27580,
        serviceFeeInCents: 4827,
        cardInterestInCents: 0,
        discountInCents: 0,
        pixDiscountInCents: 0
      }
    });

    const summary = await getOrdersSummary({ status: "PENDING_PAYMENT" }, "org_a2", null);

    expect(summary.totalOrders).toBe(1);
    expect(summary.pendingOrders).toBe(1);
    expect(summary.totalInCents).toBe(27580);
    expect(summary.serviceFeeInCents).toBe(4827);
    expect(prismaMock.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING_PAYMENT",
          id: {
            notIn: ["pending_converted"]
          }
        })
      })
    );
    expect(prismaMock.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING_PAYMENT",
          id: {
            notIn: ["pending_converted"]
          }
        })
      })
    );

    vi.clearAllMocks();
    mockEmptyResults();
    prismaMock.order.findMany
      .mockResolvedValueOnce([
        { id: "pending_converted", customerId: "customer_1", eventId: "event_1" },
        { id: "pending_open", customerId: "customer_2", eventId: "event_1" }
      ])
      .mockResolvedValueOnce([{ customerId: "customer_1", eventId: "event_1" }])
      .mockResolvedValueOnce([{ id: "pending_open" }]);
    prismaMock.order.count.mockResolvedValue(1);

    await listAdminOrders({ status: "PENDING_PAYMENT" }, "org_a2", null);

    expect(prismaMock.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING_PAYMENT",
          id: {
            notIn: ["pending_converted"]
          }
        })
      })
    );
    expect(prismaMock.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: "PENDING_PAYMENT",
        id: {
          notIn: ["pending_converted"]
        }
      })
    });
  });

  it("scopes admin tickets to the current organization", async () => {
    const { listAdminTickets, listTicketFilterEvents } = await import("@/features/tickets/ticket.admin.service");

    await listAdminTickets({}, "org_a2", null);
    await listTicketFilterEvents("org_a2", null);

    const eventScope = {
      organizationId: "org_a2",
      status: {
        not: "DRAFT"
      }
    };

    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eventScope
      })
    );
  });

  it("scopes admin support searches to the current organization", async () => {
    const { searchSupportOrders } = await import("@/features/support/support.service");

    await searchSupportOrders("cliente", "org_a2", null);

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: {
            organizationId: "org_a2",
            status: {
              not: "DRAFT"
            }
          }
        })
      })
    );
  });

  it("scopes check-in history and counters to the current organization", async () => {
    const { getCheckInStats, listRecentCheckIns } = await import("@/features/check-in/check-in.service");

    await listRecentCheckIns("org_a2", null);
    await getCheckInStats("org_a2", null);

    const eventScope = {
      organizationId: "org_a2",
      status: {
        not: "DRAFT"
      }
    };

    expect(prismaMock.checkIn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
    expect(prismaMock.checkIn.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event: eventScope
        })
      })
    );
  });
});
