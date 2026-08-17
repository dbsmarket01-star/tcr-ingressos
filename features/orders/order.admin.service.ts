import { EventStatus, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expirePendingOrders } from "./order.service";

export type AdminOrderFilters = {
  eventId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  city?: string;
  state?: string;
};

type EventScope = string[] | null | undefined;

function parseStartDate(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00-03:00`);
}

function parseEndDate(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T23:59:59.999-03:00`);
}

function parseStatus(value?: string) {
  const normalizedValue = value?.trim().toUpperCase();

  if (!normalizedValue || normalizedValue === "ALL" || !Object.values(OrderStatus).includes(normalizedValue as OrderStatus)) {
    return undefined;
  }

  return normalizedValue as OrderStatus;
}

function buildDateRangeWhere(startDate?: Date, endDate?: Date) {
  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {})
  };
}

function buildOrderDateWhere(
  startDate: Date | undefined,
  endDate: Date | undefined,
  status: OrderStatus | undefined
): Prisma.OrderWhereInput {
  if (!startDate && !endDate) {
    return {};
  }

  const dateRange = buildDateRangeWhere(startDate, endDate);

  if (status === OrderStatus.PAID) {
    return {
      paidAt: dateRange
    };
  }

  if (status) {
    return {
      createdAt: dateRange
    };
  }

  return {
    OR: [
      {
        status: OrderStatus.PAID,
        paidAt: dateRange
      },
      {
        status: {
          not: OrderStatus.PAID
        },
        createdAt: dateRange
      }
    ]
  };
}

function buildOrderEventWhere(organizationId: string, allowedEventIds?: EventScope): Prisma.EventWhereInput {
  return {
    organizationId,
    status: {
      not: EventStatus.DRAFT
    },
    ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
  };
}

function buildOrderWhere(
  filters: AdminOrderFilters,
  organizationId: string,
  allowedEventIds?: EventScope
): Prisma.OrderWhereInput {
  const startDate = parseStartDate(filters.startDate);
  const endDate = parseEndDate(filters.endDate);
  const status = parseStatus(filters.status);
  const search = filters.search?.trim();
  const dateWhere = buildOrderDateWhere(startDate, endDate, status);
  const searchWhere: Prisma.OrderWhereInput = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { couponCode: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { customer: { email: { contains: search, mode: "insensitive" } } },
          { customer: { phone: { contains: search, mode: "insensitive" } } },
          { customer: { document: { contains: search, mode: "insensitive" } } },
          { churchName: { contains: search, mode: "insensitive" } },
          { event: { title: { contains: search, mode: "insensitive" } } }
        ]
      }
    : {};
  const eventWhere: Prisma.EventWhereInput = {
    ...buildOrderEventWhere(organizationId, allowedEventIds),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.state ? { state: filters.state } : {})
  };

  return {
    event: eventWhere,
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(status ? { status } : {}),
    ...((startDate || endDate) && search ? { AND: [dateWhere, searchWhere] } : {}),
    ...((startDate || endDate) && !search ? dateWhere : {}),
    ...(search && !startDate && !endDate ? searchWhere : {})
  };
}

function mergeOrderIdExclusion(where: Prisma.OrderWhereInput, excludedIds: string[]) {
  if (excludedIds.length === 0) {
    return where;
  }

  return {
    ...where,
    id: {
      notIn: excludedIds
    }
  };
}

async function buildReportOrderWhere(
  filters: AdminOrderFilters,
  organizationId: string,
  allowedEventIds?: EventScope
) {
  const where = buildOrderWhere(filters, organizationId, allowedEventIds);
  const requestedStatus = parseStatus(filters.status);

  if (requestedStatus !== OrderStatus.PENDING_PAYMENT) {
    return where;
  }

  const pendingOrders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      customerId: true,
      eventId: true
    }
  });

  if (pendingOrders.length === 0) {
    return where;
  }

  const customerIds = Array.from(new Set(pendingOrders.map((order) => order.customerId)));
  const eventIds = Array.from(new Set(pendingOrders.map((order) => order.eventId)));
  const paidOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PAID,
      customerId: {
        in: customerIds
      },
      eventId: {
        in: eventIds
      },
      event: buildOrderEventWhere(organizationId, allowedEventIds)
    },
    select: {
      customerId: true,
      eventId: true
    }
  });
  const paidKeys = new Set(paidOrders.map((order) => `${order.customerId}:${order.eventId}`));
  const convertedPendingIds = pendingOrders
    .filter((order) => paidKeys.has(`${order.customerId}:${order.eventId}`))
    .map((order) => order.id);

  return mergeOrderIdExclusion(where, convertedPendingIds);
}

export async function listOrderFilterEvents() {
  return prisma.event.findMany({
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      city: true,
      state: true
    }
  });
}

export async function listOrderFilterEventsScoped(allowedEventIds?: EventScope) {
  return prisma.event.findMany({
    where: allowedEventIds ? { id: { in: allowedEventIds } } : undefined,
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true
    }
  });
}

export async function listOrderFilterEventsForOrganization(organizationId: string, allowedEventIds?: EventScope) {
  return prisma.event.findMany({
    where: buildOrderEventWhere(organizationId, allowedEventIds),
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      city: true,
      state: true
    }
  });
}

export async function listAdminOrders(
  filters: AdminOrderFilters = {},
  organizationId: string,
  allowedEventIds?: EventScope
) {
  await expirePendingOrders({ limit: 100, organizationId, allowedEventIds });

  const where = await buildReportOrderWhere(filters, organizationId, allowedEventIds);

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      take: 100,
      include: {
        customer: true,
        event: true,
        payment: true,
        items: {
          include: {
            lot: true,
            lotOption: true
          }
        }
      }
    }),
    prisma.order.count({ where })
  ]);

  return { orders, totalCount };
}

export async function getOrdersSummary(
  filters: AdminOrderFilters = {},
  organizationId: string,
  allowedEventIds?: EventScope
) {
  await expirePendingOrders({ limit: 100, organizationId, allowedEventIds });

  const where = await buildReportOrderWhere(filters, organizationId, allowedEventIds);
  const requestedStatus = parseStatus(filters.status);
  const financialWhere: Prisma.OrderWhereInput =
    requestedStatus === OrderStatus.PENDING_PAYMENT
      ? where
      : {
          ...where,
          ...(requestedStatus && requestedStatus !== OrderStatus.PAID
            ? { id: { in: [] } }
            : { status: OrderStatus.PAID })
        };

  const [statusGroups, totals] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true
      }
    }),
    prisma.order.aggregate({
      where: financialWhere,
      _sum: {
        totalInCents: true,
        subtotalInCents: true,
        serviceFeeInCents: true,
        cardInterestInCents: true,
        discountInCents: true,
        pixDiscountInCents: true
      }
    })
  ]);

  const totalOrders = statusGroups.reduce((sum, item) => sum + item._count._all, 0);
  const countByStatus = statusGroups.reduce(
    (acc, item) => ({
      ...acc,
      [item.status]: item._count._all
    }),
    {} as Record<OrderStatus, number>
  );

  return {
    totalOrders,
    paidOrders: countByStatus.PAID ?? 0,
    pendingOrders: countByStatus.PENDING_PAYMENT ?? 0,
    canceledOrders: (countByStatus.CANCELED ?? 0) + (countByStatus.EXPIRED ?? 0) + (countByStatus.REFUNDED ?? 0),
    totalInCents: totals._sum.totalInCents ?? 0,
    subtotalInCents: totals._sum.subtotalInCents ?? 0,
    serviceFeeInCents: totals._sum.serviceFeeInCents ?? 0,
    cardInterestInCents: totals._sum.cardInterestInCents ?? 0,
    discountInCents: totals._sum.discountInCents ?? 0,
    pixDiscountInCents: totals._sum.pixDiscountInCents ?? 0
  };
}

export async function listOrdersForCsvExport(
  filters: AdminOrderFilters = {},
  organizationId: string,
  allowedEventIds?: EventScope
) {
  await expirePendingOrders({ limit: 500, organizationId, allowedEventIds });

  return prisma.order.findMany({
    where: await buildReportOrderWhere(filters, organizationId, allowedEventIds),
    orderBy: {
      createdAt: "desc"
    },
    take: 5000,
    include: {
      customer: true,
      event: true,
      payment: true,
      items: {
        include: {
          lot: true,
          lotOption: true
        }
      }
    }
  });
}
