import { EventStatus, OrderStatus } from "@prisma/client";
import { allocateOrderAmountsAfterRefund } from "@/features/finance/order-refund-allocation";
import { getReportPeriod, formatReportDateInput } from "@/features/reports/report-period";
import { getAdmissionCount } from "@/features/tickets/admission-count";
import { prisma } from "@/lib/prisma";

export type TrafficSalesFilters = {
  startDate: string;
  endDate: string;
  eventId?: string;
};

export function validateTrafficSalesFilters(filters: TrafficSalesFilters) {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00-03:00`);
    return !Number.isNaN(parsed.getTime()) && formatReportDateInput(parsed) === value;
  };
  if (!validDate(filters.startDate) || !validDate(filters.endDate)) return "Datas inválidas. Use AAAA-MM-DD.";
  if (filters.startDate > filters.endDate) return "A data inicial deve ser anterior à final.";
  const days = Math.round((Date.parse(`${filters.endDate}T12:00:00Z`) - Date.parse(`${filters.startDate}T12:00:00Z`)) / 86_400_000);
  if (days > 366) return "O período máximo é de 367 dias.";
  if (filters.eventId && (filters.eventId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(filters.eventId))) return "Evento inválido.";
  return null;
}

type SalesOrder = {
  paidAt: Date | null;
  createdAt: Date;
  event: { id: string; slug: string; title: string; city: string; state: string; venueName: string; startsAt: Date };
  items: Array<{ quantity: number; admissionsPerUnit: number }>;
  tickets: Array<{ id: string }>;
  totalInCents: number;
  subtotalInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
  discountInCents: number;
  pixDiscountInCents: number;
  refundedInCents: number;
};

export function aggregateTrafficSales(orders: SalesOrder[]) {
  const rows = new Map<string, {
    day: string; eventId: string; slug: string; eventName: string; city: string; state: string;
    venueName: string; eventStartsAt: string; paidOrders: number; tickets: number;
    ticketSalesInCents: number; serviceFeesInCents: number; cardInterestInCents: number;
    totalPaidInCents: number; discountsInCents: number; refundedInCents: number;
  }>();
  for (const order of orders) {
    const day = formatReportDateInput(order.paidAt ?? order.createdAt);
    const key = `${day}:${order.event.id}`;
    const row = rows.get(key) ?? {
      day, eventId: order.event.id, slug: order.event.slug, eventName: order.event.title,
      city: order.event.city, state: order.event.state, venueName: order.event.venueName,
      eventStartsAt: order.event.startsAt.toISOString(), paidOrders: 0, tickets: 0,
      ticketSalesInCents: 0, serviceFeesInCents: 0, cardInterestInCents: 0,
      totalPaidInCents: 0, discountsInCents: 0, refundedInCents: 0
    };
    const effective = allocateOrderAmountsAfterRefund(order);
    row.paidOrders += 1;
    row.tickets += getAdmissionCount(order.items) || order.tickets.length;
    row.ticketSalesInCents += effective.subtotalInCents;
    row.serviceFeesInCents += effective.serviceFeeInCents;
    row.cardInterestInCents += effective.cardInterestInCents;
    row.totalPaidInCents += effective.totalInCents;
    row.discountsInCents += effective.discountInCents + effective.pixDiscountInCents;
    row.refundedInCents += effective.refundedInCents;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day) || a.eventName.localeCompare(b.eventName, "pt-BR"));
}

export async function getTrafficSalesReport(filters: TrafficSalesFilters, organizationId: string) {
  const period = getReportPeriod({ defaultDaysBack: 0, startDate: filters.startDate, endDate: filters.endDate });
  const where = {
    status: OrderStatus.PAID,
    paidAt: { gte: period.start, lte: period.end },
    event: { organizationId, status: { not: EventStatus.DRAFT } },
    ...(filters.eventId ? { eventId: filters.eventId } : {})
  };
  const orders = await prisma.order.findMany({
    where,
    select: {
      paidAt: true, createdAt: true, totalInCents: true, subtotalInCents: true,
      serviceFeeInCents: true, cardInterestInCents: true, discountInCents: true,
      pixDiscountInCents: true, refundedInCents: true,
      event: { select: { id: true, slug: true, title: true, city: true, state: true, venueName: true, startsAt: true } },
      items: { select: { quantity: true, admissionsPerUnit: true } },
      tickets: { select: { id: true } }
    }
  });
  const rows = aggregateTrafficSales(orders);
  const totals = rows.reduce((sum, row) => ({
    paidOrders: sum.paidOrders + row.paidOrders,
    tickets: sum.tickets + row.tickets,
    ticketSalesInCents: sum.ticketSalesInCents + row.ticketSalesInCents,
    serviceFeesInCents: sum.serviceFeesInCents + row.serviceFeesInCents,
    cardInterestInCents: sum.cardInterestInCents + row.cardInterestInCents,
    totalPaidInCents: sum.totalPaidInCents + row.totalPaidInCents,
    discountsInCents: sum.discountsInCents + row.discountsInCents,
    refundedInCents: sum.refundedInCents + row.refundedInCents
  }), { paidOrders: 0, tickets: 0, ticketSalesInCents: 0, serviceFeesInCents: 0,
    cardInterestInCents: 0, totalPaidInCents: 0, discountsInCents: 0, refundedInCents: 0 });
  return { source: "tcr-new", timezone: "America/Sao_Paulo", dateBasis: "paidAt",
    startDate: filters.startDate, endDate: filters.endDate, eventId: filters.eventId ?? null,
    currency: "BRL", moneyUnit: "cents", rows, totals,
    note: "Valores líquidos de estornos parciais conhecidos; estornos não são atribuídos ao dia da devolução." };
}

export async function listTrafficReportEvents(organizationId: string) {
  const events = await prisma.event.findMany({
    where: { organizationId, status: { not: EventStatus.DRAFT } },
    select: { id: true, slug: true, title: true, city: true, state: true, startsAt: true },
    orderBy: { startsAt: "desc" },
    take: 500
  });
  return { source: "tcr-new", events };
}
