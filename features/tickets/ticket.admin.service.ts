import { TicketStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminTicketFilters = {
  eventId?: string;
  status?: string;
  search?: string;
};

function parseStatus(value?: string) {
  if (!value || !Object.values(TicketStatus).includes(value as TicketStatus)) {
    return undefined;
  }

  return value as TicketStatus;
}

function buildTicketWhere(filters: AdminTicketFilters): Prisma.TicketWhereInput {
  const search = filters.search?.trim();
  const status = parseStatus(filters.status);

  return {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
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

export async function listTicketFilterEvents() {
  return prisma.event.findMany({
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true
    }
  });
}

export async function listAdminTickets(filters: AdminTicketFilters = {}) {
  const where = buildTicketWhere(filters);

  const [tickets, totalCount] = await Promise.all([
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
    prisma.ticket.count({ where })
  ]);

  return { tickets, totalCount };
}

export async function listTicketsForCsvExport(filters: AdminTicketFilters = {}) {
  return prisma.ticket.findMany({
    where: buildTicketWhere(filters),
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
