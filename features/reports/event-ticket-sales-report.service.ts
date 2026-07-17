import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EventScope = string[] | null | undefined;

export type EventTicketSalesReportRow = {
  key: string;
  ticketName: string;
  ticketType: "Online" | "Cortesia";
  unitPriceInCents: number;
  quantity: number;
  ticketRevenueInCents: number;
  serviceFeeInCents: number;
  couponDiscountInCents: number;
  refundInCents: number;
  chargebackInCents: number;
  totalInCents: number;
};

type ReportOrder = Prisma.OrderGetPayload<{
  include: {
    payment: true;
    items: {
      include: {
        lot: true;
        lotOption: true;
      };
    };
  };
}>;

function isEventAllowed(eventId: string, allowedEventIds?: EventScope) {
  return !allowedEventIds || allowedEventIds.includes(eventId);
}

function normalizeTicketName(item: ReportOrder["items"][number]) {
  if (item.lotOption?.label) {
    return `${item.lot.name} - ${item.lotOption.label}`;
  }

  return item.lot.name;
}

function detectTicketType(name: string, unitPriceInCents: number): EventTicketSalesReportRow["ticketType"] {
  if (unitPriceInCents <= 0 || /\bcortesia\b/i.test(name)) {
    return "Cortesia";
  }

  return "Online";
}

function jsonToSearchableText(value: unknown) {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isChargeback(order: Pick<ReportOrder, "payment">) {
  const failureReason = order.payment?.failureReason ?? "";
  const rawPayload = jsonToSearchableText(order.payment?.rawPayload);

  return /chargeback/i.test(`${failureReason} ${rawPayload}`);
}

function getOrderDiscountAllocation(order: ReportOrder) {
  const items = order.items;
  const discountInCents = Math.max(order.discountInCents + order.pixDiscountInCents, 0);
  const bases = items.map((item) => Math.max(item.totalInCents + item.serviceFeeInCents, 0));
  const totalBase = bases.reduce((sum, base) => sum + base, 0);
  let allocated = 0;

  return new Map(
    items.map((item, index) => {
      const discount =
        totalBase > 0 && discountInCents > 0
          ? index === items.length - 1
            ? Math.max(discountInCents - allocated, 0)
            : Math.round(discountInCents * (bases[index] / totalBase))
          : 0;

      allocated += discount;
      return [item.id, discount];
    })
  );
}

function sortRows(left: EventTicketSalesReportRow, right: EventTicketSalesReportRow) {
  const nameComparison = left.ticketName.localeCompare(right.ticketName, "pt-BR");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  if (left.unitPriceInCents !== right.unitPriceInCents) {
    return left.unitPriceInCents - right.unitPriceInCents;
  }

  return left.ticketType.localeCompare(right.ticketType, "pt-BR");
}

export async function getEventTicketSalesReport(
  organizationId: string,
  eventId: string,
  allowedEventIds?: EventScope
) {
  if (!isEventAllowed(eventId, allowedEventIds)) {
    return null;
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId
    },
    include: {
      organization: {
        select: {
          name: true
        }
      }
    }
  });

  if (!event) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: {
      eventId: event.id,
      status: {
        in: [OrderStatus.PAID, OrderStatus.REFUNDED]
      }
    },
    include: {
      payment: true,
      items: {
        include: {
          lot: true,
          lotOption: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      paidAt: "asc"
    }
  });

  const rows = new Map<string, EventTicketSalesReportRow>();

  for (const order of orders) {
    const discountByItemId = getOrderDiscountAllocation(order);
    const reversed = order.status === OrderStatus.REFUNDED || order.payment?.status === PaymentStatus.REFUNDED;
    const chargeback = reversed && isChargeback(order);

    for (const item of order.items) {
      const ticketName = normalizeTicketName(item);
      const ticketType = detectTicketType(ticketName, item.unitPriceInCents);
      const key = [
        item.lotId,
        item.lotOptionId ?? "lot",
        item.unitPriceInCents,
        ticketType
      ].join(":");
      const row = rows.get(key) ?? {
        key,
        ticketName,
        ticketType,
        unitPriceInCents: item.unitPriceInCents,
        quantity: 0,
        ticketRevenueInCents: 0,
        serviceFeeInCents: 0,
        couponDiscountInCents: 0,
        refundInCents: 0,
        chargebackInCents: 0,
        totalInCents: 0
      };
      const couponDiscountInCents = discountByItemId.get(item.id) ?? 0;
      const reversedAmountInCents = Math.max(item.totalInCents + item.serviceFeeInCents - couponDiscountInCents, 0);

      row.quantity += item.quantity;
      row.ticketRevenueInCents += item.totalInCents;
      row.serviceFeeInCents += item.serviceFeeInCents;
      row.couponDiscountInCents += couponDiscountInCents;

      if (chargeback) {
        row.chargebackInCents += reversedAmountInCents;
      } else if (reversed) {
        row.refundInCents += reversedAmountInCents;
      }

      row.totalInCents =
        row.ticketRevenueInCents +
        row.serviceFeeInCents -
        row.couponDiscountInCents -
        row.refundInCents -
        row.chargebackInCents;
      rows.set(key, row);
    }
  }

  const sortedRows = Array.from(rows.values()).sort(sortRows);

  return {
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt
    },
    organization: {
      name: event.organization.name
    },
    rows: sortedRows,
    totals: sortedRows.reduce(
      (totals, row) => ({
        quantity: totals.quantity + row.quantity,
        ticketRevenueInCents: totals.ticketRevenueInCents + row.ticketRevenueInCents,
        serviceFeeInCents: totals.serviceFeeInCents + row.serviceFeeInCents,
        couponDiscountInCents: totals.couponDiscountInCents + row.couponDiscountInCents,
        refundInCents: totals.refundInCents + row.refundInCents,
        chargebackInCents: totals.chargebackInCents + row.chargebackInCents,
        totalInCents: totals.totalInCents + row.totalInCents
      }),
      {
        quantity: 0,
        ticketRevenueInCents: 0,
        serviceFeeInCents: 0,
        couponDiscountInCents: 0,
        refundInCents: 0,
        chargebackInCents: 0,
        totalInCents: 0
      }
    )
  };
}
