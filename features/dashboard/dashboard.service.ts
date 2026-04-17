import { prisma } from "@/lib/prisma";

export async function getDashboardMetrics() {
  const [
    revenue,
    orderCounts,
    ticketCounts,
    checkInCounts,
    events,
    eventTicketCounts,
    recentOrders
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: "PAID"
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

  return {
    totals: {
      revenueInCents: revenue._sum.totalInCents ?? 0,
      orders: orderCounts.reduce((sum, item) => sum + item._count._all, 0),
      paidOrders: countByOrderStatus.PAID ?? 0,
      pendingOrders: countByOrderStatus.PENDING_PAYMENT ?? 0,
      canceledOrders: countByOrderStatus.CANCELED ?? 0,
      ticketsIssued: ticketCounts.reduce((sum, item) => sum + item._count._all, 0),
      ticketsActive: countByTicketStatus.ACTIVE ?? 0,
      ticketsUsed: countByTicketStatus.USED ?? 0,
      checkInsApproved: countByCheckInStatus.APPROVED ?? 0,
      checkInsBlocked:
        (countByCheckInStatus.ALREADY_USED ?? 0) +
        (countByCheckInStatus.INVALID ?? 0) +
        (countByCheckInStatus.CANCELED ?? 0)
    },
    events: eventRows,
    recentOrders
  };
}
