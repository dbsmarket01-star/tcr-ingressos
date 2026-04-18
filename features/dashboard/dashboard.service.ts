import { PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DashboardFilters = {
  startDate?: string;
  endDate?: string;
};

type PaymentMethod = "PIX" | "CREDIT_CARD" | "SIMULATED" | "OTHER";

function parseStartDate(value?: string) {
  if (!value) {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return new Date(`${value}T00:00:00-03:00`);
}

function parseEndDate(value?: string) {
  if (!value) {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }

  return new Date(`${value}T23:59:59.999-03:00`);
}

function formatDateInput(value: Date) {
  const offsetInMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetInMs).toISOString().slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractPaymentPayload(rawPayload: unknown) {
  const root = asRecord(rawPayload);
  const nestedPayment = asRecord(root?.payment);
  return nestedPayment ?? root;
}

function extractBillingType(rawPayload: unknown, provider: PaymentProvider, hasPixQrCode: boolean): PaymentMethod {
  if (provider === "SIMULATED") {
    return "SIMULATED";
  }

  const payload = extractPaymentPayload(rawPayload);
  const billingType = typeof payload?.billingType === "string" ? payload.billingType : null;

  if (billingType === "PIX") {
    return "PIX";
  }

  if (billingType === "CREDIT_CARD") {
    return "CREDIT_CARD";
  }

  if (hasPixQrCode) {
    return "PIX";
  }

  return "OTHER";
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export async function getDashboardMetrics(filters: DashboardFilters = {}) {
  const periodStart = parseStartDate(filters.startDate);
  const periodEnd = parseEndDate(filters.endDate);
  const paidAtPeriod = {
    gte: periodStart,
    lte: periodEnd
  };
  const createdAtPeriod = {
    gte: periodStart,
    lte: periodEnd
  };

  const [
    revenue,
    orderCounts,
    periodOrderCounts,
    paidOrdersInPeriod,
    previousPaidCustomers,
    ticketCounts,
    checkInCounts,
    events,
    eventTicketCounts,
    recentOrders
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: "PAID",
        paidAt: paidAtPeriod
      },
      _sum: {
        totalInCents: true
      }
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        createdAt: createdAtPeriod
      },
      _count: {
        _all: true
      }
    }),
    prisma.order.findMany({
      where: {
        status: "PAID",
        paidAt: paidAtPeriod
      },
      select: {
        id: true,
        customerId: true,
        totalInCents: true,
        payment: {
          select: {
            provider: true,
            pixQrCodePayload: true,
            rawPayload: true
          }
        }
      }
    }),
    prisma.order.findMany({
      where: {
        status: "PAID",
        paidAt: {
          lt: periodStart
        }
      },
      distinct: ["customerId"],
      select: {
        customerId: true
      }
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.checkIn.groupBy({
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.event.findMany({
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      include: {
        lots: true,
        orders: {
          where: {
            status: "PAID"
          },
          select: {
            totalInCents: true
          }
        }
      }
    }),
    prisma.ticket.groupBy({
      by: ["eventId", "status"],
      _count: {
        _all: true
      }
    }),
    prisma.order.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 8,
      include: {
        customer: true,
        event: true,
        payment: true
      }
    })
  ]);

  const countByOrderStatus = Object.fromEntries(
    orderCounts.map((item) => [item.status, item._count._all])
  );
  const countByPeriodOrderStatus = Object.fromEntries(
    periodOrderCounts.map((item) => [item.status, item._count._all])
  );
  const countByTicketStatus = Object.fromEntries(
    ticketCounts.map((item) => [item.status, item._count._all])
  );
  const countByCheckInStatus = Object.fromEntries(
    checkInCounts.map((item) => [item.status, item._count._all])
  );
  const ticketCountByEvent = new Map<string, { active: number; used: number }>();

  for (const item of eventTicketCounts) {
    const current = ticketCountByEvent.get(item.eventId) ?? { active: 0, used: 0 };

    if (item.status === "ACTIVE") {
      current.active = item._count._all;
    }

    if (item.status === "USED") {
      current.used = item._count._all;
    }

    ticketCountByEvent.set(item.eventId, current);
  }

  const eventRows = events.map((event) => {
    const totalCapacity = event.lots.reduce((sum, lot) => sum + lot.totalQuantity, 0);
    const soldQuantity = event.lots.reduce((sum, lot) => sum + lot.soldQuantity, 0);
    const reservedQuantity = event.lots.reduce((sum, lot) => sum + lot.reservedQuantity, 0);
    const revenueInCents = event.orders.reduce((sum, order) => sum + order.totalInCents, 0);
    const eventTickets = ticketCountByEvent.get(event.id) ?? { active: 0, used: 0 };

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt,
      city: event.city,
      state: event.state,
      totalCapacity,
      soldQuantity,
      reservedQuantity,
      revenueInCents,
      activeTickets: eventTickets.active,
      usedTickets: eventTickets.used
    };
  });

  const previousCustomerIds = new Set(previousPaidCustomers.map((item) => item.customerId));
  const periodCustomerIds = new Set<string>();
  const paidByPaymentMethod = {
    pix: { count: 0, revenueInCents: 0 },
    card: { count: 0, revenueInCents: 0 },
    other: { count: 0, revenueInCents: 0 }
  };

  let returningCustomerOrders = 0;

  for (const order of paidOrdersInPeriod) {
    periodCustomerIds.add(order.customerId);

    if (previousCustomerIds.has(order.customerId)) {
      returningCustomerOrders += 1;
    }

    const method = extractBillingType(
      order.payment?.rawPayload,
      order.payment?.provider ?? PaymentProvider.SIMULATED,
      Boolean(order.payment?.pixQrCodePayload)
    );

    if (method === "PIX") {
      paidByPaymentMethod.pix.count += 1;
      paidByPaymentMethod.pix.revenueInCents += order.totalInCents;
      continue;
    }

    if (method === "CREDIT_CARD") {
      paidByPaymentMethod.card.count += 1;
      paidByPaymentMethod.card.revenueInCents += order.totalInCents;
      continue;
    }

    paidByPaymentMethod.other.count += 1;
    paidByPaymentMethod.other.revenueInCents += order.totalInCents;
  }

  const paidOrdersTotal = paidOrdersInPeriod.length;
  const newCustomerOrders = paidOrdersTotal - returningCustomerOrders;

  return {
    period: {
      startDate: formatDateInput(periodStart),
      endDate: formatDateInput(periodEnd)
    },
    totals: {
      revenueInCents: revenue._sum.totalInCents ?? 0,
      orders: orderCounts.reduce((sum, item) => sum + item._count._all, 0),
      paidOrders: paidOrdersTotal,
      pendingOrders: countByPeriodOrderStatus.PENDING_PAYMENT ?? 0,
      canceledOrders:
        (countByPeriodOrderStatus.CANCELED ?? 0) +
        (countByPeriodOrderStatus.EXPIRED ?? 0) +
        (countByPeriodOrderStatus.REFUNDED ?? 0),
      ticketsIssued: ticketCounts.reduce((sum, item) => sum + item._count._all, 0),
      ticketsActive: countByTicketStatus.ACTIVE ?? 0,
      ticketsUsed: countByTicketStatus.USED ?? 0,
      checkInsApproved: countByCheckInStatus.APPROVED ?? 0,
      checkInsBlocked:
        (countByCheckInStatus.ALREADY_USED ?? 0) +
        (countByCheckInStatus.INVALID ?? 0) +
        (countByCheckInStatus.CANCELED ?? 0)
    },
    periodMetrics: {
      ordersCreated: periodOrderCounts.reduce((sum, item) => sum + item._count._all, 0),
      approvedRate: percentage(paidOrdersTotal, periodOrderCounts.reduce((sum, item) => sum + item._count._all, 0)),
      averageTicketInCents:
        paidOrdersTotal > 0 ? Math.round((revenue._sum.totalInCents ?? 0) / paidOrdersTotal) : 0,
      uniqueCustomers: periodCustomerIds.size,
      newCustomerOrders,
      returningCustomerOrders,
      newCustomerRate: percentage(newCustomerOrders, paidOrdersTotal),
      returningCustomerRate: percentage(returningCustomerOrders, paidOrdersTotal),
      paymentMethods: {
        pix: {
          ...paidByPaymentMethod.pix,
          rate: percentage(paidByPaymentMethod.pix.count, paidOrdersTotal)
        },
        card: {
          ...paidByPaymentMethod.card,
          rate: percentage(paidByPaymentMethod.card.count, paidOrdersTotal)
        },
        other: {
          ...paidByPaymentMethod.other,
          rate: percentage(paidByPaymentMethod.other.count, paidOrdersTotal)
        }
      }
    },
    allTime: {
      paidOrders: countByOrderStatus.PAID ?? 0,
      pendingOrders: countByOrderStatus.PENDING_PAYMENT ?? 0,
      canceledOrders: countByOrderStatus.CANCELED ?? 0
    },
    events: eventRows,
    recentOrders
  };
}
