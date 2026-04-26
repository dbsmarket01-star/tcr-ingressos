import { TicketStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminTicketFilters = {
  eventId?: string;
  status?: string;
  search?: string;
};

type EventScope = string[] | null | undefined;

function parseStatus(value?: string) {
  if (!value || !Object.values(TicketStatus).includes(value as TicketStatus)) {
    return undefined;
  }

  return value as TicketStatus;
}

function buildTicketWhere(filters: AdminTicketFilters, allowedEventIds?: EventScope): Prisma.TicketWhereInput {
  const search = filters.search?.trim();
  const status = parseStatus(filters.status);

  return {
    ...(filters.eventId
      ? { eventId: filters.eventId }
      : allowedEventIds
        ? { eventId: { in: allowedEventIds } }
        : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { order: { code: { contains: search, mode: "insensitive" } } },
            { order: { customer: { name: { contains: search, mode: "insensitive" } } } },
            { order: { customer: { email: { contains: search, mode: "insensitive" } } } },
            { event: { title: { contains: search, mode: "insensitive" } } },
            { lot: { name: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {})
  };
}

export async function listTicketFilterEvents(allowedEventIds?: EventScope) {
  return prisma.event.findMany({
    where: allowedEventIds ? { id: { in: allowedEventIds } } : undefined,
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true
    }
  });
}

export async function listAdminTickets(filters: AdminTicketFilters = {}, allowedEventIds?: EventScope) {
  const where = buildTicketWhere(filters, allowedEventIds);

  const [tickets, totalCount, groupedStatusCounts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: {
        issuedAt: "desc"
      },
      take: 120,
      include: {
        event: true,
        lot: true,
        order: {
          include: {
            customer: true
          }
        }
      }
    }),
    prisma.ticket.count({ where }),
    prisma.ticket.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true
      }
    })
  ]);

  const statusCounts = groupedStatusCounts.reduce<Record<TicketStatus, number>>(
    (acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    },
    {
      ACTIVE: 0,
      USED: 0,
      CANCELED: 0,
      INVALID: 0
    }
  );

  return { tickets, totalCount, statusCounts };
}

export async function listTicketsForCsvExport(filters: AdminTicketFilters = {}, allowedEventIds?: EventScope) {
  return prisma.ticket.findMany({
    where: buildTicketWhere(filters, allowedEventIds),
    orderBy: {
      issuedAt: "desc"
    },
    take: 10000,
    include: {
      event: true,
      lot: true,
      order: {
        include: {
          customer: true
        }
      }
    }
  });
}
