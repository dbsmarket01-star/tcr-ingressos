import { prisma } from "@/lib/prisma";
import {
  createPublicOrderUrl,
  createPublicTicketUrl,
  sendOrderPendingPaymentEmail,
  sendTicketsEmail
} from "@/features/email/email.service";

type EventScope = string[] | null | undefined;

function buildSupportWhere(query?: string, allowedEventIds?: EventScope) {
  const term = query?.trim();
  const digits = term?.replace(/\D/g, "");

  return {
    ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {}),
    ...(term
      ? {
          OR: [
            { code: { contains: term, mode: "insensitive" as const } },
            { event: { title: { contains: term, mode: "insensitive" as const } } },
            { customer: { name: { contains: term, mode: "insensitive" as const } } },
            { customer: { email: { contains: term, mode: "insensitive" as const } } },
            { customer: { phone: { contains: term, mode: "insensitive" as const } } },
            { customer: { document: { contains: term, mode: "insensitive" as const } } },
            ...(digits
              ? [
                  { customer: { phone: { contains: digits, mode: "insensitive" as const } } },
                  { customer: { document: { contains: digits, mode: "insensitive" as const } } }
                ]
              : []),
            { tickets: { some: { code: { contains: term, mode: "insensitive" as const } } } },
            { tickets: { some: { qrCodeToken: { contains: term, mode: "insensitive" as const } } } }
          ]
        }
      : {})
  };
}

export async function searchSupportOrders(query?: string, allowedEventIds?: EventScope) {
  return prisma.order.findMany({
    where: buildSupportWhere(query, allowedEventIds),
    orderBy: {
      createdAt: "desc"
    },
    take: 30,
    include: {
      customer: true,
      event: true,
      payment: true,
      items: {
        include: {
          lot: true
        }
      },
      tickets: {
        orderBy: {
          issuedAt: "asc"
        },
        include: {
          lot: true
        }
      }
    }
  });
}

export async function resendTicketsEmailByOrderCode(orderCode: string, allowedEventIds?: EventScope) {
  const order = await prisma.order.findFirst({
    where: {
      code: orderCode,
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true
            }
          }
        }
      },
      tickets: {
        orderBy: {
          issuedAt: "asc"
        },
        include: {
          lot: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Pedido não encontrado.");
  }

  if (order.tickets.length === 0) {
    throw new Error("Este pedido ainda não possui ingressos emitidos.");
  }

  await sendTicketsEmail({
    to: order.customer.email,
    buyerName: order.customer.name,
    orderCode: order.code,
    brandName: order.event.organization?.name || "TCR Ingressos",
    eventTitle: order.event.title,
    eventDate: order.event.startsAt,
    venueName: order.event.venueName,
    tickets: order.tickets.map((ticket) => ({
      code: ticket.code,
      lotName: ticket.lot.name,
      url: createPublicTicketUrl(ticket.code, order.event.organization)
    }))
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ticketsEmailSentAt: new Date()
    }
  });

  return {
    email: order.customer.email,
    orderCode: order.code
  };
}

export async function resendPendingPaymentEmailByOrderCode(orderCode: string, allowedEventIds?: EventScope) {
  const order = await prisma.order.findFirst({
    where: {
      code: orderCode,
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error("Pedido não encontrado.");
  }

  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("Apenas pedidos pendentes podem receber novo link de pagamento.");
  }

  await sendOrderPendingPaymentEmail({
    to: order.customer.email,
    buyerName: order.customer.name,
    orderCode: order.code,
    brandName: order.event.organization?.name || "TCR Ingressos",
    eventTitle: order.event.title,
    eventDate: order.event.startsAt,
    venueName: order.event.venueName,
    totalInCents: order.totalInCents,
    expiresAt: order.expiresAt,
    orderUrl: createPublicOrderUrl(order.code, order.event.organization)
  });

  return {
    email: order.customer.email,
    orderCode: order.code
  };
}
