import { EventPageVisitType, EventStatus, OrderStatus, PaymentProvider, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DashboardFilters = {
  startDate?: string;
  endDate?: string;
};

type EventScope = string[] | null | undefined;
type PaymentMethod = "PIX" | "CREDIT_CARD" | "SIMULATED" | "OTHER";

function buildDashboardEventWhere(organizationId: string, allowedEventIds?: EventScope): Prisma.EventWhereInput {
  return {
    organizationId,
    status: {
      not: EventStatus.DRAFT
    },
    ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
  };
}

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

function isManualSalePayload(rawPayload: unknown) {
  return extractPaymentPayload(rawPayload)?.origin === "MANUAL_SALE";
}

function extractBillingType(rawPayload: unknown, provider: PaymentProvider, hasPixQrCode: boolean): PaymentMethod {
  const payload = extractPaymentPayload(rawPayload);
  const billingType = typeof payload?.billingType === "string" ? payload.billingType : null;

  if (isManualSalePayload(rawPayload)) {
    if (billingType === "PIX") {
      return "PIX";
    }

    if (billingType === "CREDIT_CARD") {
      return "CREDIT_CARD";
    }

    return "OTHER";
  }

  if (provider === "SIMULATED") {
    return "SIMULATED";
  }

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

  return Number(((value / total) * 100).toFixed(2));
}

function changePercent(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function formatDayKey(value: Date) {
  return formatDateInput(value);
}

function formatBrazilDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function buildDateSeries(start: Date, end: Date) {
  const days: Array<{ key: string; label: string; date: Date }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push({
      key: formatDayKey(cursor),
      label: formatDayLabel(cursor),
      date: new Date(cursor)
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

type PaidOrderLite = {
  customerId: string;
  subtotalInCents: number;
  serviceFeeInCents: number;
  totalInCents: number;
  paidAt: Date | null;
  createdAt: Date;
  event: {
    id: string;
    title: string;
    city: string;
    state: string;
    bannerUrl: string | null;
  };
  customer: {
    name: string;
    email: string;
  };
  payment: {
    provider: PaymentProvider;
    pixQrCodePayload: string | null;
    rawPayload: unknown;
  } | null;
  items: Array<{
    quantity: number;
    lot: {
      name: string;
    };
  }>;
  tickets: Array<{
    id: string;
    status: string;
  }>;
};

function getPaidTicketQuantity(orders: PaidOrderLite[]) {
  return orders.reduce((sum, order) => {
    const itemQuantity = order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    return sum + (itemQuantity || order.tickets.length);
  }, 0);
}

function computeCustomerBreakdown(orders: PaidOrderLite[], previousCustomerIds: Set<string>) {
  const paidOrdersTotal = orders.length;
  const uniqueCustomers = new Set<string>();
  const newCustomers = new Set<string>();
  const recurringCustomers = new Set<string>();

  for (const order of orders) {
    uniqueCustomers.add(order.customerId);
    if (previousCustomerIds.has(order.customerId)) {
      recurringCustomers.add(order.customerId);
    } else {
      newCustomers.add(order.customerId);
    }
  }

  return {
    paidOrdersTotal,
    uniqueCustomers: uniqueCustomers.size,
    newCustomers: newCustomers.size,
    recurringCustomers: recurringCustomers.size,
    newCustomerRate: percentage(newCustomers.size, uniqueCustomers.size),
    recurringCustomerRate: percentage(recurringCustomers.size, uniqueCustomers.size)
  };
}

export async function getDashboardMetrics(
  filters: DashboardFilters = {},
  organizationId: string,
  allowedEventIds?: EventScope
) {
  const periodStart = parseStartDate(filters.startDate);
  const periodEnd = parseEndDate(filters.endDate);
  const periodMs = periodEnd.getTime() - periodStart.getTime() + 1;
  const previousPeriodEnd = new Date(periodStart.getTime() - 1);
  const previousPeriodStart = new Date(periodStart.getTime() - periodMs);
  const currentPeriodStartKey = formatBrazilDateKey(periodStart);
  const currentPeriodEndKey = formatBrazilDateKey(periodEnd);
  const dashboardEventWhere = buildDashboardEventWhere(organizationId, allowedEventIds);

  const paidPeriodWhere = {
    status: "PAID" as const,
    event: dashboardEventWhere,
    paidAt: {
      gte: periodStart,
      lte: periodEnd
    }
  };

  const previousPaidPeriodWhere = {
    status: "PAID" as const,
    event: dashboardEventWhere,
    paidAt: {
      gte: previousPeriodStart,
      lte: previousPeriodEnd
    }
  };

  const createdPeriodWhere = {
    status: {
      not: OrderStatus.REFUNDED
    },
    event: dashboardEventWhere,
    createdAt: {
      gte: periodStart,
      lte: periodEnd
    }
  };

  const previousCreatedPeriodWhere = {
    status: {
      not: OrderStatus.REFUNDED
    },
    event: dashboardEventWhere,
    createdAt: {
      gte: previousPeriodStart,
      lte: previousPeriodEnd
    }
  };

  const [
    currentPaidOrders,
    previousPaidOrders,
    currentOrdersCreated,
    previousOrdersCreated,
    previousCustomersBeforePeriod,
    previousCustomersBeforePreviousPeriod,
    ticketCounts,
    checkInCounts,
    events,
    eventTicketCounts,
    recentOrders,
    recentLeads,
    recentCheckIns,
    currentPublicEventVisits
  ] = await Promise.all([
    prisma.order.findMany({
      where: paidPeriodWhere,
      orderBy: {
        paidAt: "desc"
      },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            city: true,
            state: true,
            bannerUrl: true
          }
        },
        customer: true,
        payment: {
          select: {
            provider: true,
            pixQrCodePayload: true,
            rawPayload: true
          }
        },
        items: {
          include: {
            lot: true
          }
        },
        tickets: {
          select: {
            id: true,
            status: true
          }
        }
      }
    }),
    prisma.order.findMany({
      where: previousPaidPeriodWhere,
      orderBy: {
        paidAt: "desc"
      },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            city: true,
            state: true,
            bannerUrl: true
          }
        },
        customer: true,
        payment: {
          select: {
            provider: true,
            pixQrCodePayload: true,
            rawPayload: true
          }
        },
        items: {
          include: {
            lot: true
          }
        },
        tickets: {
          select: {
            id: true,
            status: true
          }
        }
      }
    }),
    prisma.order.count({
      where: createdPeriodWhere
    }),
    prisma.order.count({
      where: previousCreatedPeriodWhere
    }),
    prisma.order.findMany({
      where: {
        status: "PAID",
        event: dashboardEventWhere,
        paidAt: {
          lt: periodStart
        }
      },
      distinct: ["customerId"],
      select: {
        customerId: true
      }
    }),
    prisma.order.findMany({
      where: {
        status: "PAID",
        event: dashboardEventWhere,
        paidAt: {
          lt: previousPeriodStart
        }
      },
      distinct: ["customerId"],
      select: {
        customerId: true
      }
    }),
    prisma.ticket.groupBy({
      where: {
        event: dashboardEventWhere,
        status: {
          in: ["ACTIVE", "USED"]
        }
      },
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.checkIn.groupBy({
      where: {
        event: dashboardEventWhere
      },
      by: ["status"],
      _count: {
        _all: true
      }
    }),
    prisma.event.findMany({
      where: dashboardEventWhere,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      include: {
        lots: true,
        orders: {
          where: paidPeriodWhere,
          select: {
            totalInCents: true
          }
        }
      }
    }),
    prisma.ticket.groupBy({
      where: {
        event: dashboardEventWhere
      },
      by: ["eventId", "status"],
      _count: {
        _all: true
      }
    }),
    prisma.order.findMany({
      where: {
        event: dashboardEventWhere,
        status: {
          not: OrderStatus.REFUNDED
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8,
      include: {
        customer: true,
        event: true,
        payment: true,
        items: {
          include: {
            lot: true
          }
        }
      }
    }),
    prisma.eventLead.findMany({
      where: {
        event: dashboardEventWhere,
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 6,
      include: {
        event: {
          select: {
            title: true
          }
        }
      }
    }),
    prisma.checkIn.findMany({
      where: {
        event: dashboardEventWhere
      },
      orderBy: {
        checkedAt: "desc"
      },
      take: 6,
      include: {
        ticket: {
          include: {
            order: {
              include: {
                customer: true
              }
            }
          }
        },
        event: true
      }
    }),
    prisma.eventPageVisit.count({
      where: {
        pageType: EventPageVisitType.PUBLIC_EVENT,
        visitedOn: {
          gte: currentPeriodStartKey,
          lte: currentPeriodEndKey
        },
        event: dashboardEventWhere
      }
    })
  ]);

  const currentRevenueInCents = currentPaidOrders.reduce((sum, order) => sum + order.totalInCents, 0);
  const previousRevenueInCents = previousPaidOrders.reduce((sum, order) => sum + order.totalInCents, 0);
  const currentTicketSalesInCents = currentPaidOrders.reduce((sum, order) => sum + order.subtotalInCents, 0);
  const previousTicketSalesInCents = previousPaidOrders.reduce((sum, order) => sum + order.subtotalInCents, 0);
  const currentServiceFeesInCents = currentPaidOrders.reduce((sum, order) => sum + order.serviceFeeInCents, 0);
  const previousServiceFeesInCents = previousPaidOrders.reduce((sum, order) => sum + order.serviceFeeInCents, 0);
  const currentPaidTicketQuantity = getPaidTicketQuantity(currentPaidOrders as PaidOrderLite[]);
  const previousPaidTicketQuantity = getPaidTicketQuantity(previousPaidOrders as PaidOrderLite[]);
  const currentAverageTicket = currentPaidTicketQuantity > 0 ? Math.round(currentRevenueInCents / currentPaidTicketQuantity) : 0;
  const previousAverageTicket = previousPaidTicketQuantity > 0 ? Math.round(previousRevenueInCents / previousPaidTicketQuantity) : 0;

  const currentCustomerBreakdown = computeCustomerBreakdown(
    currentPaidOrders as PaidOrderLite[],
    new Set(previousCustomersBeforePeriod.map((item) => item.customerId))
  );
  const previousCustomerBreakdown = computeCustomerBreakdown(
    previousPaidOrders as PaidOrderLite[],
    new Set(previousCustomersBeforePreviousPeriod.map((item) => item.customerId))
  );

  const countByTicketStatus = Object.fromEntries(ticketCounts.map((item) => [item.status, item._count._all]));
  const issuedTicketCount = (countByTicketStatus.ACTIVE ?? 0) + (countByTicketStatus.USED ?? 0);
  const countByCheckInStatus = Object.fromEntries(checkInCounts.map((item) => [item.status, item._count._all]));
  const ticketCountByEvent = new Map<string, { active: number; used: number }>();

  for (const item of eventTicketCounts) {
    const current = ticketCountByEvent.get(item.eventId) ?? { active: 0, used: 0 };
    if (item.status === "ACTIVE") current.active = item._count._all;
    if (item.status === "USED") current.used = item._count._all;
    ticketCountByEvent.set(item.eventId, current);
  }

  const eventPerformanceMap = new Map<
    string,
    {
      id: string;
      slug: string;
      title: string;
      bannerUrl: string | null;
      count: number;
      revenueInCents: number;
    }
  >();

  const dailySalesMap = new Map<string, number>();
  const dailySalesCountMap = new Map<string, number>();
  const topCitiesMap = new Map<string, { label: string; count: number }>();
  const paymentMethodTotals = {
    pix: { revenueInCents: 0, count: 0 },
    card: { revenueInCents: 0, count: 0 },
    other: { revenueInCents: 0, count: 0 }
  };

  for (const order of currentPaidOrders as PaidOrderLite[]) {
    const paidAt = order.paidAt ?? order.createdAt;
    const dayKey = formatDayKey(paidAt);
    dailySalesMap.set(dayKey, (dailySalesMap.get(dayKey) ?? 0) + order.totalInCents);
    dailySalesCountMap.set(dayKey, (dailySalesCountMap.get(dayKey) ?? 0) + 1);

    const eventPerformance = eventPerformanceMap.get(order.event.id) ?? {
      id: order.event.id,
      slug: (order.event as { slug?: string }).slug ?? "",
      title: order.event.title,
      bannerUrl: order.event.bannerUrl,
      count: 0,
      revenueInCents: 0
    };
    eventPerformance.count += 1;
    eventPerformance.revenueInCents += order.totalInCents;
    eventPerformanceMap.set(order.event.id, eventPerformance);

    const cityKey = `${order.event.city.trim().toLocaleLowerCase("pt-BR")}|${order.event.state.trim().toLocaleLowerCase("pt-BR")}`;
    const cityEntry = topCitiesMap.get(cityKey) ?? {
      label: `${order.event.city}, ${order.event.state}`,
      count: 0
    };
    cityEntry.count += 1;
    topCitiesMap.set(cityKey, cityEntry);

    const method = extractBillingType(
      order.payment?.rawPayload,
      order.payment?.provider ?? PaymentProvider.SIMULATED,
      Boolean(order.payment?.pixQrCodePayload)
    );

    if (method === "PIX") {
      paymentMethodTotals.pix.count += 1;
      paymentMethodTotals.pix.revenueInCents += order.totalInCents;
    } else if (method === "CREDIT_CARD") {
      paymentMethodTotals.card.count += 1;
      paymentMethodTotals.card.revenueInCents += order.totalInCents;
    } else {
      paymentMethodTotals.other.count += 1;
      paymentMethodTotals.other.revenueInCents += order.totalInCents;
    }
  }

  const eventRows = events.map((event) => {
    const totalCapacity = event.lots.reduce((sum, lot) => sum + lot.totalQuantity, 0);
    const soldQuantity = event.lots.reduce((sum, lot) => sum + lot.soldQuantity, 0);
    const reservedQuantity = event.lots.reduce((sum, lot) => sum + lot.reservedQuantity, 0);
    const revenueInCents = event.orders.reduce((sum, order) => sum + order.totalInCents, 0);
    const eventTickets = ticketCountByEvent.get(event.id) ?? { active: 0, used: 0 };
    const periodEventPerformance = eventPerformanceMap.get(event.id);
    const conversionRate = totalCapacity > 0 ? percentage(periodEventPerformance?.count ?? 0, totalCapacity) : 0;

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      bannerUrl: event.bannerUrl,
      status: event.status,
      startsAt: event.startsAt,
      city: event.city,
      state: event.state,
      totalCapacity,
      soldQuantity,
      reservedQuantity,
      revenueInCents,
      activeTickets: eventTickets.active,
      usedTickets: eventTickets.used,
      periodSalesCount: periodEventPerformance?.count ?? 0,
      periodRevenueInCents: periodEventPerformance?.revenueInCents ?? 0,
      conversionRate
    };
  });

  const dateSeries = buildDateSeries(periodStart, periodEnd);
  const salesByDay = dateSeries.map((day) => ({
    date: day.key,
    label: day.label,
    revenueInCents: dailySalesMap.get(day.key) ?? 0,
    salesCount: dailySalesCountMap.get(day.key) ?? 0
  }));
  const maxDailyRevenueInCents = Math.max(...salesByDay.map((item) => item.revenueInCents), 0);

  const totalPaymentRevenueInCents =
    paymentMethodTotals.pix.revenueInCents +
    paymentMethodTotals.card.revenueInCents +
    paymentMethodTotals.other.revenueInCents;

  const topLocations = Array.from(topCitiesMap.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      rate: percentage(item.count, currentPaidOrders.length)
    }));

  const recentActivities = [
    ...recentOrders.map((order) => ({
      id: `order-${order.id}`,
      title:
        order.status === "PAID"
          ? "Venda realizada"
          : order.status === "REFUNDED"
            ? "Reembolso processado"
            : order.status === "PENDING_PAYMENT"
              ? "Pedido iniciado"
              : "Movimentação de pedido",
      subtitle: `Pedido ${order.code}`,
      metaLabel: order.status === "PAID" ? "Cliente" : "Evento",
      meta:
        order.status === "PAID"
          ? order.customer.name
          : order.event.title,
      happenedAt: order.paidAt ?? order.updatedAt ?? order.createdAt
    })),
    ...recentCheckIns.map((checkIn) => ({
      id: `checkin-${checkIn.id}`,
      title: "Check-in realizado",
      subtitle: `Ingresso ${checkIn.ticket.code}`,
      metaLabel: "Cliente",
      meta: checkIn.ticket.order.customer.name,
      happenedAt: checkIn.checkedAt
    })),
    ...recentLeads.map((lead) => ({
      id: `lead-${lead.id}`,
      title: "Novo cliente cadastrado",
      subtitle: lead.name,
      metaLabel: "Evento",
      meta: lead.event.title,
      happenedAt: lead.createdAt
    }))
  ]
    .sort((left, right) => right.happenedAt.getTime() - left.happenedAt.getTime())
    .slice(0, 8);

  return {
    period: {
      startDate: formatDateInput(periodStart),
      endDate: formatDateInput(periodEnd)
    },
    kpis: {
      revenueInCents: currentRevenueInCents,
      revenueChangePercent: changePercent(currentRevenueInCents, previousRevenueInCents),
      ticketSalesInCents: currentTicketSalesInCents,
      ticketSalesChangePercent: changePercent(currentTicketSalesInCents, previousTicketSalesInCents),
      serviceFeesInCents: currentServiceFeesInCents,
      serviceFeesChangePercent: changePercent(currentServiceFeesInCents, previousServiceFeesInCents),
      paidOrders: currentPaidOrders.length,
      paidOrdersChangePercent: changePercent(currentPaidOrders.length, previousPaidOrders.length),
      averageTicketInCents: currentAverageTicket,
      averageTicketChangePercent: changePercent(currentAverageTicket, previousAverageTicket),
      newCustomers: currentCustomerBreakdown.newCustomers,
      newCustomersChangePercent: changePercent(
        currentCustomerBreakdown.newCustomers,
        previousCustomerBreakdown.newCustomers
      ),
      recurringCustomers: currentCustomerBreakdown.recurringCustomers,
      recurringCustomersChangePercent: changePercent(
        currentCustomerBreakdown.recurringCustomers,
        previousCustomerBreakdown.recurringCustomers
      ),
      conversionRate: percentage(currentPaidOrders.length, currentOrdersCreated),
      conversionRateChangePercent: changePercent(
        percentage(currentPaidOrders.length, currentOrdersCreated),
        percentage(previousPaidOrders.length, previousOrdersCreated)
      )
    },
    salesByDay,
    maxDailyRevenueInCents,
    paymentMethods: {
      pix: {
        ...paymentMethodTotals.pix,
        rate: percentage(paymentMethodTotals.pix.revenueInCents, totalPaymentRevenueInCents)
      },
      card: {
        ...paymentMethodTotals.card,
        rate: percentage(paymentMethodTotals.card.revenueInCents, totalPaymentRevenueInCents)
      },
      other: {
        ...paymentMethodTotals.other,
        rate: percentage(paymentMethodTotals.other.revenueInCents, totalPaymentRevenueInCents)
      },
      totalRevenueInCents: totalPaymentRevenueInCents
    },
    eventPerformance: eventRows
      .filter((event) => event.periodSalesCount > 0)
      .sort((left, right) => right.periodRevenueInCents - left.periodRevenueInCents)
      .slice(0, 5),
    funnel: {
      visitors: currentPublicEventVisits,
      startedCheckout: currentOrdersCreated,
      purchased: currentPaidOrders.length,
      conversionRate: percentage(currentPaidOrders.length, currentPublicEventVisits)
    },
    operations: {
      ticketsIssued: issuedTicketCount,
      checkInsApproved: countByCheckInStatus.APPROVED ?? 0,
      pendingOrders: currentOrdersCreated - currentPaidOrders.length
    },
    customers: {
      newCustomers: currentCustomerBreakdown.newCustomers,
      recurringCustomers: currentCustomerBreakdown.recurringCustomers,
      newCustomerRate: currentCustomerBreakdown.newCustomerRate,
      recurringCustomerRate: currentCustomerBreakdown.recurringCustomerRate
    },
    topLocations,
    recentOrders,
    recentActivities,
    totals: {
      ticketsIssued: issuedTicketCount
    }
  };
}
