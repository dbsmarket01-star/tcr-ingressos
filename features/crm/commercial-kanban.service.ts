import { CheckInStatus, EventStatus, OrderStatus, PaymentProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expirePendingOrders } from "@/features/orders/order.service";

type EventScope = string[] | null | undefined;
const MINIMUM_KANBAN_ORDER_AMOUNT_IN_CENTS = 5000;

export type CommercialKanbanFilters = {
  endDate?: string;
  eventId?: string;
  search?: string;
  startDate?: string;
};

export type CommercialKanbanStage =
  | "LEAD"
  | "ABANDONED"
  | "PENDING"
  | "APPROVED"
  | "DELIVERED"
  | "CHECKED_IN";

export const commercialKanbanStages: Array<{
  id: CommercialKanbanStage;
  title: string;
  description: string;
}> = [
  {
    id: "LEAD",
    title: "Leads novos",
    description: "Pessoas captadas que ainda não geraram pedido."
  },
  {
    id: "ABANDONED",
    title: "Carrinho abandonado",
    description: "Pedidos expirados, cancelados ou pendentes há mais tempo."
  },
  {
    id: "PENDING",
    title: "Pagamento pendente",
    description: "Pedidos recentes aguardando Pix ou cartão."
  },
  {
    id: "APPROVED",
    title: "Compra aprovada",
    description: "Vendas pagas aguardando entrega/validação."
  },
  {
    id: "DELIVERED",
    title: "Ingresso entregue",
    description: "Ingressos já enviados por e-mail."
  },
  {
    id: "CHECKED_IN",
    title: "Check-in realizado",
    description: "Clientes que já passaram pela entrada."
  }
];

const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  customer: true,
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      city: true,
      state: true
    }
  },
  payment: true,
  items: {
    include: {
      lot: {
        select: {
          id: true,
          name: true,
          hasHotel: true
        }
      }
    }
  },
  tickets: {
    select: {
      id: true,
      status: true,
      checkIns: {
        where: {
          status: CheckInStatus.APPROVED
        },
        select: {
          id: true,
          checkedAt: true
        }
      }
    }
  }
});

const leadInclude = Prisma.validator<Prisma.EventLeadInclude>()({
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      city: true,
      state: true
    }
  }
});

type CommercialOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type CommercialLead = Prisma.EventLeadGetPayload<{ include: typeof leadInclude }>;

export type CommercialKanbanCard = {
  id: string;
  type: "ORDER" | "LEAD";
  stage: CommercialKanbanStage;
  title: string;
  subtitle: string;
  eventTitle: string;
  eventId: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  city?: string | null;
  amountInCents: number;
  quantity: number;
  statusLabel: string;
  paymentLabel?: string;
  orderCode?: string;
  lotNames: string[];
  hasHotel: boolean;
  churchName?: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  whatsappHref?: string;
  detailHref: string;
};

export type CommercialKanbanColumn = {
  id: CommercialKanbanStage;
  title: string;
  description: string;
  cards: CommercialKanbanCard[];
  totalInCents: number;
};

export type CommercialKanbanBoard = {
  events: Array<{
    id: string;
    title: string;
  }>;
  columns: CommercialKanbanColumn[];
  summary: {
    cards: number;
    leads: number;
    openOpportunities: number;
    approvedSales: number;
    potentialInCents: number;
    paidInCents: number;
  };
};

function buildEventScopeWhere(organizationId: string, allowedEventIds?: EventScope): Prisma.EventWhereInput {
  return {
    organizationId,
    status: {
      not: EventStatus.DRAFT
    },
    ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
  };
}

function normalizeSearch(value?: string) {
  const search = value?.trim();
  return search || undefined;
}

function parseDateBoundary(value: string | undefined, boundary: "start" | "end") {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const suffix = boundary === "start" ? "T00:00:00.000-03:00" : "T23:59:59.999-03:00";
  const date = new Date(`${value}${suffix}`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildDateRangeFilter(filters: CommercialKanbanFilters): Prisma.DateTimeFilter | undefined {
  const startDate = parseDateBoundary(filters.startDate, "start");
  const endDate = parseDateBoundary(filters.endDate, "end");

  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {})
  };
}

function buildOrderActivityDateWhere(filters: CommercialKanbanFilters): Prisma.OrderWhereInput {
  const dateRange = buildDateRangeFilter(filters);

  if (!dateRange) {
    return {};
  }

  return {
    OR: [
      { createdAt: dateRange },
      { paidAt: dateRange },
      { ticketsEmailSentAt: dateRange },
      { ticketsEmailDeliveredAt: dateRange },
      { canceledAt: dateRange }
    ]
  };
}

function buildLeadActivityDateWhere(filters: CommercialKanbanFilters): Prisma.EventLeadWhereInput {
  const dateRange = buildDateRangeFilter(filters);

  if (!dateRange) {
    return {};
  }

  return {
    OR: [
      { createdAt: dateRange },
      { thankYouViewedAt: dateRange },
      { whatsappClickedAt: dateRange }
    ]
  };
}

function normalizePhoneForWhatsapp(phone?: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length < 10) {
    return null;
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  return `55${digits.replace(/^0+/, "")}`;
}

function buildWhatsappHref(phone?: string | null) {
  const whatsappPhone = normalizePhoneForWhatsapp(phone);

  if (!whatsappPhone) {
    return undefined;
  }

  return `https://wa.me/${whatsappPhone}`;
}

function getPaymentLabel(order: CommercialOrder) {
  if (!order.payment) {
    return "A definir";
  }

  if (order.payment.provider === PaymentProvider.ASAAS && order.payment.pixQrCodePayload) {
    return "Pix";
  }

  const cardProviders: PaymentProvider[] = [PaymentProvider.MERCADO_PAGO, PaymentProvider.PAGARME, PaymentProvider.STRIPE];

  if (cardProviders.includes(order.payment.provider)) {
    return "Cartao";
  }

  if (order.payment.provider === PaymentProvider.SIMULATED) {
    return "Simulado";
  }

  return "Outro";
}

function getOrderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    DRAFT: "Rascunho",
    PENDING_PAYMENT: "Pendente",
    PAID: "Pago",
    CANCELED: "Cancelado",
    EXPIRED: "Expirado",
    REFUNDED: "Reembolsado"
  };

  return labels[status];
}

function getOrderStage(order: CommercialOrder, now = new Date()): CommercialKanbanStage {
  const approvedCheckIns = order.tickets.reduce((total, ticket) => total + ticket.checkIns.length, 0);

  if (order.status === OrderStatus.PAID && approvedCheckIns > 0) {
    return "CHECKED_IN";
  }

  if (order.status === OrderStatus.PAID && (order.ticketsEmailDeliveredAt || order.ticketsEmailSentAt)) {
    return "DELIVERED";
  }

  if (order.status === OrderStatus.PAID) {
    return "APPROVED";
  }

  const recoveryStatuses: OrderStatus[] = [OrderStatus.CANCELED, OrderStatus.EXPIRED, OrderStatus.REFUNDED];

  if (recoveryStatuses.includes(order.status)) {
    return "ABANDONED";
  }

  if (order.status === OrderStatus.PENDING_PAYMENT) {
    const ageInMinutes = Math.floor((now.getTime() - order.createdAt.getTime()) / 60000);

    return ageInMinutes >= 30 ? "ABANDONED" : "PENDING";
  }

  return "ABANDONED";
}

function buildOrderCard(order: CommercialOrder, now = new Date()): CommercialKanbanCard {
  const lotNames = Array.from(new Set(order.items.map((item) => item.lot.name)));
  const quantity = order.items.reduce((total, item) => total + item.quantity, 0);
  const stage = getOrderStage(order, now);

  return {
    id: `order-${order.id}`,
    type: "ORDER",
    stage,
    title: order.customer.name,
    subtitle: `Pedido ${order.code}`,
    eventTitle: order.event.title,
    eventId: order.eventId,
    email: order.customer.email,
    phone: order.customer.phone,
    document: order.customer.document,
    city: `${order.event.city}, ${order.event.state}`,
    amountInCents: order.totalInCents,
    quantity,
    statusLabel: getOrderStatusLabel(order.status),
    paymentLabel: getPaymentLabel(order),
    orderCode: order.code,
    lotNames,
    hasHotel: order.items.some((item) => item.lot.hasHotel),
    churchName: order.churchName,
    createdAt: order.createdAt,
    lastActivityAt: order.paidAt ?? order.updatedAt ?? order.createdAt,
    whatsappHref: buildWhatsappHref(order.customer.phone),
    detailHref: `/admin/orders/${order.code}`
  };
}

function buildLeadCard(lead: CommercialLead): CommercialKanbanCard {
  const interactedWithWhatsapp = lead.whatsappClickedAt || lead.whatsappClickCount > 0;

  return {
    id: `lead-${lead.id}`,
    type: "LEAD",
    stage: "LEAD",
    title: lead.name,
    subtitle: interactedWithWhatsapp ? "Lead com clique no WhatsApp" : "Lead captado",
    eventTitle: lead.event.title,
    eventId: lead.eventId,
    email: lead.email,
    phone: lead.phone,
    city: lead.municipality || `${lead.event.city}, ${lead.event.state}`,
    amountInCents: 0,
    quantity: 0,
    statusLabel: interactedWithWhatsapp ? "Interagiu" : "Novo",
    lotNames: [],
    hasHotel: false,
    createdAt: lead.createdAt,
    lastActivityAt: lead.whatsappClickedAt ?? lead.thankYouViewedAt ?? lead.createdAt,
    whatsappHref: buildWhatsappHref(lead.phone),
    detailHref: `/admin/events/${lead.eventId}/leads?search=${encodeURIComponent(lead.email)}`
  };
}

function buildOrderWhere(
  filters: CommercialKanbanFilters,
  organizationId: string,
  allowedEventIds?: EventScope,
  options: { enforceMinimumAmount?: boolean } = { enforceMinimumAmount: true }
): Prisma.OrderWhereInput {
  const search = normalizeSearch(filters.search);
  const activityDateWhere = buildOrderActivityDateWhere(filters);
  const searchWhere: Prisma.OrderWhereInput = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { churchName: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { customer: { email: { contains: search, mode: "insensitive" } } },
          { customer: { phone: { contains: search, mode: "insensitive" } } },
          { customer: { document: { contains: search, mode: "insensitive" } } },
          { event: { title: { contains: search, mode: "insensitive" } } }
        ]
      }
    : {};
  const combinedFilters = [activityDateWhere, searchWhere].filter((filter) => Object.keys(filter).length > 0);

  return {
    event: buildEventScopeWhere(organizationId, allowedEventIds),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    status: {
      in: [
        OrderStatus.DRAFT,
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PAID,
        OrderStatus.CANCELED,
        OrderStatus.EXPIRED,
        OrderStatus.REFUNDED
      ]
    },
    ...(options.enforceMinimumAmount === false
      ? {}
      : {
          totalInCents: {
            gte: MINIMUM_KANBAN_ORDER_AMOUNT_IN_CENTS
          }
        }),
    ...(combinedFilters.length ? { AND: combinedFilters } : {})
  };
}

function buildLeadWhere(
  filters: CommercialKanbanFilters,
  organizationId: string,
  allowedEventIds?: EventScope
): Prisma.EventLeadWhereInput {
  const search = normalizeSearch(filters.search);
  const activityDateWhere = buildLeadActivityDateWhere(filters);
  const searchWhere: Prisma.EventLeadWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { municipality: { contains: search, mode: "insensitive" } },
          { event: { title: { contains: search, mode: "insensitive" } } }
        ]
      }
    : {};
  const combinedFilters = [activityDateWhere, searchWhere].filter((filter) => Object.keys(filter).length > 0);

  return {
    event: buildEventScopeWhere(organizationId, allowedEventIds),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(combinedFilters.length ? { AND: combinedFilters } : {})
  };
}

export async function getCommercialKanbanBoard(
  filters: CommercialKanbanFilters,
  organizationId: string,
  allowedEventIds?: EventScope
): Promise<CommercialKanbanBoard> {
  await expirePendingOrders({ limit: 100, organizationId, allowedEventIds });

  const [events, orders, orderLeadKeys, leads] = await Promise.all([
    prisma.event.findMany({
      where: buildEventScopeWhere(organizationId, allowedEventIds),
      orderBy: [{ startsAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true
      }
    }),
    prisma.order.findMany({
      where: buildOrderWhere(filters, organizationId, allowedEventIds),
      orderBy: {
        updatedAt: "desc"
      },
      take: 240,
      include: orderInclude
    }),
    prisma.order.findMany({
      where: buildOrderWhere(filters, organizationId, allowedEventIds, { enforceMinimumAmount: false }),
      take: 1000,
      select: {
        eventId: true,
        customer: {
          select: {
            email: true
          }
        }
      }
    }),
    prisma.eventLead.findMany({
      where: buildLeadWhere(filters, organizationId, allowedEventIds),
      orderBy: {
        updatedAt: "desc"
      },
      take: 180,
      include: leadInclude
    })
  ]);

  const now = new Date();
  const orderCards = orders.map((order) => buildOrderCard(order, now));
  const orderEmailKeys = new Set(
    orderLeadKeys.map((order) => `${order.eventId}:${order.customer.email.toLowerCase().trim()}`)
  );
  const leadCards = leads
    .filter((lead) => !orderEmailKeys.has(`${lead.eventId}:${lead.email.toLowerCase().trim()}`))
    .map(buildLeadCard);
  const cards = [...orderCards, ...leadCards].sort(
    (left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime()
  );

  const columns = commercialKanbanStages.map((stage) => {
    const stageCards = cards.filter((card) => card.stage === stage.id);

    return {
      ...stage,
      cards: stageCards,
      totalInCents: stageCards.reduce((total, card) => total + card.amountInCents, 0)
    };
  });

  return {
    events,
    columns,
    summary: {
      cards: cards.length,
      leads: leadCards.length,
      openOpportunities: cards.filter((card) => ["LEAD", "ABANDONED", "PENDING"].includes(card.stage)).length,
      approvedSales: orderCards.filter((card) => ["APPROVED", "DELIVERED", "CHECKED_IN"].includes(card.stage)).length,
      potentialInCents: orderCards
        .filter((card) => ["ABANDONED", "PENDING"].includes(card.stage))
        .reduce((total, card) => total + card.amountInCents, 0),
      paidInCents: orderCards
        .filter((card) => ["APPROVED", "DELIVERED", "CHECKED_IN"].includes(card.stage))
        .reduce((total, card) => total + card.amountInCents, 0)
    }
  };
}
