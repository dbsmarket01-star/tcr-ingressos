import { EventStatus, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expirePendingOrders } from "./order.service";

export type AdminOrderFilters = {
  eventId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
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
  if (!value || !Object.values(OrderStatus).includes(value as OrderStatus)) {
    return undefined;
  }

  return value as OrderStatus;
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

  return {
    event: buildOrderEventWhere(organizationId, allowedEventIds),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(status
      ? { status }
      : {
          status: {
            in: [
              OrderStatus.DRAFT,
              OrderStatus.PENDING_PAYMENT,
              OrderStatus.CANCELED,
              OrderStatus.EXPIRED,
              OrderStatus.REFUNDED
            ]
          }
        }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {})
          }
        }
      : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { couponCode: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
            { customer: { email: { contains: search, mode: "insensitive" } } },
            { customer: { phone: { contains: search, mode: "insensitive" } } },
            { customer: { document: { contains: search, mode: "insensitive" } } },
            { event: { title: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };
}

export async function listOrderFilterEvents() {
  return prisma.event.findMany({
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true
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
      title: true
    }
  });
}

export async function listAdminOrders(
  filters: AdminOrderFilters = {},
  organizationId: string,
  allowedEventIds?: EventScope
) {
  await expirePendingOrders({ limit: 100, organizationId, allowedEventIds });

  const where = buildOrderWhere(filters, organizationId, allowedEventIds);

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
            lot: true
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

  const where = buildOrderWhere(filters, organizationId, allowedEventIds);

  const [statusGroups, totals] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true
      }
    }),
    prisma.order.aggregate({
      where,
      _sum: {
        totalInCents: true,
        serviceFeeInCents: true,
        cardInterestInCents: true,
        discountInCents: true
      }
    })
  ]);

  const countByStatus = statusGroups.reduce(
    (acc, item) => ({
      ...acc,
      [item.status]: item._count._all
    }),
    {} as Record<OrderStatus, number>
  );

  return {
    paidOrders: countByStatus.PAID ?? 0,
    pendingOrders: countByStatus.PENDING_PAYMENT ?? 0,
    canceledOrders: (countByStatus.CANCELED ?? 0) + (countByStatus.EXPIRED ?? 0),
    totalInCents: totals._sum.totalInCents ?? 0,
    serviceFeeInCents: totals._sum.serviceFeeInCents ?? 0,
    cardInterestInCents: totals._sum.cardInterestInCents ?? 0,
    discountInCents: totals._sum.discountInCents ?? 0
  };
}

export async function listOrdersForCsvExport(
  filters: AdminOrderFilters = {},
  organizationId: string,
  allowedEventIds?: EventScope
) {
  await expirePendingOrders({ limit: 500, organizationId, allowedEventIds });

  return prisma.order.findMany({
    where: buildOrderWhere(filters, organizationId, allowedEventIds),
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
          lot: true
        }
      }
    }
  });
}
