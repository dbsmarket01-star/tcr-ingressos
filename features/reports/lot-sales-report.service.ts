import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getLotAlert(soldPercent: number, availableQuantity: number, reservedQuantity: number) {
  if (availableQuantity <= 0) {
    return {
      level: "danger" as const,
      label: "Esgotado ou sem disponibilidade",
      action: "Conferir se deve abrir novo lote."
    };
  }

  if (availableQuantity <= 10 || soldPercent >= 90) {
    return {
      level: "warning" as const,
      label: "Lote quase esgotando",
      action: "Preparar virada de lote ou pausar anuncios se necessario."
    };
  }

  if (reservedQuantity > availableQuantity && reservedQuantity >= 5) {
    return {
      level: "warning" as const,
      label: "Muitas reservas pendentes",
      action: "Rodar liberacao de reservas vencidas."
    };
  }

  return {
    level: "ok" as const,
    label: "Operacao normal",
    action: "Sem acao imediata."
  };
}

export async function getLotSalesReport(eventId?: string) {
  const [events, lots] = await Promise.all([
    prisma.event.findMany({
      orderBy: [{ startsAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true
      }
    }),
    prisma.ticketLot.findMany({
      where: {
        ...(eventId ? { eventId } : {})
      },
      orderBy: [{ event: { startsAt: "desc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true
          }
        },
        orderItems: {
          where: {
            order: {
              status: OrderStatus.PAID
            }
          },
          select: {
            quantity: true,
            unitPriceInCents: true,
            serviceFeeInCents: true,
            totalInCents: true,
            order: {
              select: {
                cardInterestInCents: true,
                discountInCents: true
              }
            }
          }
        },
        tickets: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })
  ]);

  const rows = lots.map((lot) => {
    const paidQuantity = lot.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const ticketRevenueInCents = lot.orderItems.reduce((sum, item) => sum + item.totalInCents, 0);
    const serviceFeeInCents = lot.orderItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
    const usedTickets = lot.tickets.filter((ticket) => ticket.status === "USED").length;
    const activeTickets = lot.tickets.filter((ticket) => ticket.status === "ACTIVE").length;
    const availableQuantity = Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0);
    const soldPercent = lot.totalQuantity > 0 ? Math.round((lot.soldQuantity / lot.totalQuantity) * 100) : 0;
    const issuedTickets = activeTickets + usedTickets;
    const checkInPercent = issuedTickets > 0 ? Math.round((usedTickets / issuedTickets) * 100) : 0;
    const averageGrossPerSoldTicketInCents =
      paidQuantity > 0 ? Math.round((ticketRevenueInCents + serviceFeeInCents) / paidQuantity) : 0;
    const alert = getLotAlert(soldPercent, availableQuantity, lot.reservedQuantity);

    return {
      id: lot.id,
      eventId: lot.event.id,
      eventTitle: lot.event.title,
      eventStartsAt: lot.event.startsAt,
      eventStatus: lot.event.status,
      name: lot.name,
      status: lot.status,
      priceInCents: lot.priceInCents,
      totalQuantity: lot.totalQuantity,
      soldQuantity: lot.soldQuantity,
      paidQuantity,
      reservedQuantity: lot.reservedQuantity,
      availableQuantity,
      soldPercent,
      ticketRevenueInCents,
      serviceFeeInCents,
      grossInCents: ticketRevenueInCents + serviceFeeInCents,
      activeTickets,
      usedTickets,
      issuedTickets,
      checkInPercent,
      averageGrossPerSoldTicketInCents,
      alert
    };
  });

  const criticalAlerts = rows.filter((row) => row.alert.level !== "ok");
  const totalIssuedTickets = rows.reduce((sum, row) => sum + row.issuedTickets, 0);
  const totalUsedTickets = rows.reduce((sum, row) => sum + row.usedTickets, 0);
  const totalSold = rows.reduce((sum, row) => sum + row.soldQuantity, 0);
  const totalCapacity = rows.reduce((sum, row) => sum + row.totalQuantity, 0);
  const totalGrossInCents = rows.reduce((sum, row) => sum + row.grossInCents, 0);

  return {
    filters: {
      eventId: eventId || ""
    },
    events,
    totals: {
      totalLots: rows.length,
      totalCapacity,
      totalSold,
      totalReserved: rows.reduce((sum, row) => sum + row.reservedQuantity, 0),
      totalAvailable: rows.reduce((sum, row) => sum + row.availableQuantity, 0),
      totalGrossInCents,
      totalUsedTickets,
      totalIssuedTickets,
      totalOccupancyPercent: totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0,
      totalCheckInPercent: totalIssuedTickets > 0 ? Math.round((totalUsedTickets / totalIssuedTickets) * 100) : 0,
      averageGrossPerSoldTicketInCents: totalSold > 0 ? Math.round(totalGrossInCents / totalSold) : 0,
      criticalAlerts: criticalAlerts.length
    },
    alerts: criticalAlerts,
    rows
  };
}
