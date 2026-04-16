import { OrderStatus, PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSourceLabel } from "@/features/tracking/tracking";
import { summarizeAsaasSplit } from "@/features/payments/split-report.service";

type FinanceReportFilters = {
  eventId?: string;
  startDate?: string;
  endDate?: string;
};

type PaymentMethod = "PIX" | "CREDIT_CARD" | "SIMULATED" | "OTHER";

function parseStartDate(value?: string) {
  if (!value) {
    const date = new Date();
    date.setDate(date.getDate() - 30);
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

function extractNetValueInCents(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  const netValue = payload?.netValue;

  if (typeof netValue !== "number" || !Number.isFinite(netValue)) {
    return null;
  }

  return Math.round(netValue * 100);
}

function addToMap<T extends { grossInCents: number; netInCents: number; count: number }>(
  map: Map<string, T>,
  key: string,
  seed: T,
  grossInCents: number,
  netInCents: number
) {
  const current = map.get(key) ?? seed;
  current.count += 1;
  current.grossInCents += grossInCents;
  current.netInCents += netInCents;
  map.set(key, current);
}

function addBreakdownToMap<
  T extends {
    ticketSubtotalInCents: number;
    serviceFeeInCents: number;
    cardInterestInCents: number;
    discountInCents: number;
  }
>(
  row: T,
  ticketSubtotalInCents: number,
  serviceFeeInCents: number,
  cardInterestInCents: number,
  discountInCents: number
) {
  row.ticketSubtotalInCents += ticketSubtotalInCents;
  row.serviceFeeInCents += serviceFeeInCents;
  row.cardInterestInCents += cardInterestInCents;
  row.discountInCents += discountInCents;
}

export async function getFinanceReport(filters: FinanceReportFilters) {
  const startDate = parseStartDate(filters.startDate);
  const endDate = parseEndDate(filters.endDate);
  const eventId = filters.eventId || undefined;

  const [events, ordersInPeriod, paidOrders] = await Promise.all([
    prisma.event.findMany({
      orderBy: [{ startsAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true
      }
    }),
    prisma.order.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        event: {
          select: {
            id: true,
            title: true
          }
        },
        customer: true,
        payment: true,
        items: true,
        tickets: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        ...(eventId ? { eventId } : {}),
        paidAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        event: {
          select: {
            id: true,
            title: true
          }
        },
        customer: true,
        payment: true,
        tickets: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        paidAt: "desc"
      }
    })
  ]);

  const statusCounts = Object.fromEntries(
    Object.values(OrderStatus).map((status) => [
      status,
      ordersInPeriod.filter((order) => order.status === status).length
    ])
  ) as Record<OrderStatus, number>;

  const paymentStatusCounts = Object.fromEntries(
    Object.values(PaymentStatus).map((status) => [
      status,
      ordersInPeriod.filter((order) => order.payment?.status === status).length
    ])
  ) as Record<PaymentStatus, number>;

  const byEvent = new Map<
    string,
    {
      id: string;
      title: string;
      count: number;
      grossInCents: number;
      netInCents: number;
      ticketSubtotalInCents: number;
      serviceFeeInCents: number;
      cardInterestInCents: number;
      discountInCents: number;
      tickets: number;
    }
  >();
  const byMethod = new Map<
    PaymentMethod,
    {
      method: PaymentMethod;
      count: number;
      grossInCents: number;
      netInCents: number;
      ticketSubtotalInCents: number;
      serviceFeeInCents: number;
      cardInterestInCents: number;
      discountInCents: number;
    }
  >();
  const bySource = new Map<
    string,
    {
      source: string;
      count: number;
      grossInCents: number;
      netInCents: number;
      ticketSubtotalInCents: number;
      serviceFeeInCents: number;
      cardInterestInCents: number;
      discountInCents: number;
    }
  >();
  const bySplitWallet = new Map<
    string,
    {
      walletId: string;
      walletLabel: string;
      status: string;
      count: number;
      totalInCents: number;
    }
  >();

  let grossRevenueInCents = 0;
  let netRevenueInCents = 0;
  let ticketSubtotalInCents = 0;
  let serviceFeeInCents = 0;
  let cardInterestInCents = 0;
  let discountInCents = 0;
  let splitTotalInCents = 0;
  let splitPaymentsCount = 0;
  let netValueKnownCount = 0;

  for (const order of paidOrders) {
    const gross = order.totalInCents;
    const orderTicketSubtotal = order.subtotalInCents;
    const orderServiceFee = order.serviceFeeInCents;
    const orderCardInterest = order.cardInterestInCents;
    const orderDiscount = order.discountInCents;
    const netFromProvider = extractNetValueInCents(order.payment?.rawPayload);
    const splitSummary = summarizeAsaasSplit(order.payment?.rawPayload);
    const net = netFromProvider ?? gross;
    const method = extractBillingType(
      order.payment?.rawPayload,
      order.payment?.provider ?? PaymentProvider.SIMULATED,
      Boolean(order.payment?.pixQrCodePayload)
    );

    grossRevenueInCents += gross;
    netRevenueInCents += net;
    ticketSubtotalInCents += orderTicketSubtotal;
    serviceFeeInCents += orderServiceFee;
    cardInterestInCents += orderCardInterest;
    discountInCents += orderDiscount;
    splitTotalInCents += splitSummary.totalInCents;
    splitPaymentsCount += splitSummary.entries.length > 0 ? 1 : 0;
    netValueKnownCount += netFromProvider === null ? 0 : 1;

    for (const splitEntry of splitSummary.entries) {
      const key = `${splitEntry.walletId}:${splitEntry.status}`;
      const current = bySplitWallet.get(key) ?? {
        walletId: splitEntry.walletId,
        walletLabel: splitEntry.walletLabel,
        status: splitEntry.status,
        count: 0,
        totalInCents: 0
      };

      current.count += 1;
      current.totalInCents += splitEntry.totalInCents;
      bySplitWallet.set(key, current);
    }

    addToMap(
      byEvent,
      order.event.id,
      {
        id: order.event.id,
        title: order.event.title,
        count: 0,
        grossInCents: 0,
        netInCents: 0,
        ticketSubtotalInCents: 0,
        serviceFeeInCents: 0,
        cardInterestInCents: 0,
        discountInCents: 0,
        tickets: 0
      },
      gross,
      net
    );

    const eventRow = byEvent.get(order.event.id);
    if (eventRow) {
      eventRow.tickets += order.tickets.length;
      addBreakdownToMap(eventRow, orderTicketSubtotal, orderServiceFee, orderCardInterest, orderDiscount);
    }

    addToMap(
      byMethod,
      method,
      {
        method,
        count: 0,
        grossInCents: 0,
        netInCents: 0,
        ticketSubtotalInCents: 0,
        serviceFeeInCents: 0,
        cardInterestInCents: 0,
        discountInCents: 0
      },
      gross,
      net
    );

    const methodRow = byMethod.get(method);
    if (methodRow) {
      addBreakdownToMap(methodRow, orderTicketSubtotal, orderServiceFee, orderCardInterest, orderDiscount);
    }

    const sourceLabel = getSourceLabel(order.utmSource, order.utmMedium);
    addToMap(
      bySource,
      sourceLabel,
      {
        source: sourceLabel,
        count: 0,
        grossInCents: 0,
        netInCents: 0,
        ticketSubtotalInCents: 0,
        serviceFeeInCents: 0,
        cardInterestInCents: 0,
        discountInCents: 0
      },
      gross,
      net
    );

    const sourceRow = bySource.get(sourceLabel);
    if (sourceRow) {
      addBreakdownToMap(sourceRow, orderTicketSubtotal, orderServiceFee, orderCardInterest, orderDiscount);
    }
  }

  const pendingAmountInCents = ordersInPeriod
    .filter((order) => order.status === OrderStatus.PENDING_PAYMENT)
    .reduce((sum, order) => sum + order.totalInCents, 0);

  const canceledAmountInCents = ordersInPeriod
    .filter((order) => order.status === OrderStatus.CANCELED || order.status === OrderStatus.EXPIRED)
    .reduce((sum, order) => sum + order.totalInCents, 0);

  return {
    filters: {
      eventId: eventId ?? "",
      startDate: formatDateInput(startDate),
      endDate: formatDateInput(endDate)
    },
    events,
    totals: {
      grossRevenueInCents,
      netRevenueInCents,
      ticketSubtotalInCents,
      serviceFeeInCents,
      cardInterestInCents,
      discountInCents,
      estimatedFeesInCents: Math.max(grossRevenueInCents - netRevenueInCents, 0),
      pendingAmountInCents,
      canceledAmountInCents,
      ordersInPeriod: ordersInPeriod.length,
      paidOrders: paidOrders.length,
      pendingOrders: statusCounts.PENDING_PAYMENT ?? 0,
      canceledOrders:
        (statusCounts.CANCELED ?? 0) + (statusCounts.EXPIRED ?? 0) + (statusCounts.REFUNDED ?? 0),
      approvedPayments: paymentStatusCounts.APPROVED ?? 0,
      failedPayments: (paymentStatusCounts.FAILED ?? 0) + (paymentStatusCounts.CANCELED ?? 0),
      ticketsIssued: paidOrders.reduce((sum, order) => sum + order.tickets.length, 0),
      netValueCoverage: paidOrders.length > 0 ? Math.round((netValueKnownCount / paidOrders.length) * 100) : 0,
      splitTotalInCents,
      splitPaymentsCount,
      splitCoverage: paidOrders.length > 0 ? Math.round((splitPaymentsCount / paidOrders.length) * 100) : 0,
      tcrAfterSplitInCents: Math.max(netRevenueInCents - splitTotalInCents, 0)
    },
    byEvent: Array.from(byEvent.values()).sort((a, b) => b.grossInCents - a.grossInCents),
    byMethod: Array.from(byMethod.values()).sort((a, b) => b.grossInCents - a.grossInCents),
    bySource: Array.from(bySource.values()).sort((a, b) => b.grossInCents - a.grossInCents),
    bySplitWallet: Array.from(bySplitWallet.values()).sort((a, b) => b.totalInCents - a.totalInCents),
    recentPaidOrders: paidOrders.slice(0, 12).map((order) => ({
      ...order,
      splitSummary: summarizeAsaasSplit(order.payment?.rawPayload)
    })),
    recentOrders: ordersInPeriod.slice(0, 12)
  };
}
