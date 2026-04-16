import { prisma } from "@/lib/prisma";
import {
  createPublicOrderUrl,
  createPublicTicketUrl,
  sendOrderPendingPaymentEmail,
  sendTicketsEmail
} from "@/features/email/email.service";

export async function searchSupportOrders(query?: string) {
  const term = query?.trim();
  const digits = term?.replace(/\D/g, "");

  return prisma.order.findMany({
    where: term
      ? {
          OR: [
            { code: { contains: term, mode: "insensitive" } },
            { event: { title: { contains: term, mode: "insensitive" } } },
            { customer: { name: { contains: term, mode: "insensitive" } } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
            { customer: { phone: { contains: term, mode: "insensitive" } } },
            { customer: { document: { contains: term, mode: "insensitive" } } },
            ...(digits
              ? [
                  { customer: { phone: { contains: digits, mode: "insensitive" as const } } },
                  { customer: { document: { contains: digits, mode: "insensitive" as const } } }
                ]
              : []),
            { tickets: { some: { code: { contains: term, mode: "insensitive" } } } },
            { tickets: { some: { qrCodeToken: { contains: term, mode: "insensitive" } } } }
          ]
        }
      : undefined,
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

export async function resendTicketsEmailByOrderCode(orderCode: string) {
  const order = await prisma.order.findUnique({
    where: {
      code: orderCode
    },
    include: {
      customer: true,
      event: true,
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
    throw new Error("Pedido nao encontrado.");
  }

  if (order.tickets.length === 0) {
    throw new Error("Este pedido ainda nao possui ingressos emitidos.");
  }

  await sendTicketsEmail({
    to: order.customer.email,
    buyerName: order.customer.name,
    orderCode: order.code,
    eventTitle: order.event.title,
    eventDate: order.event.startsAt,
    venueName: order.event.venueName,
    tickets: order.tickets.map((ticket) => ({
      code: ticket.code,
      lotName: ticket.lot.name,
      url: createPublicTicketUrl(ticket.code)
    }))
  });

  return {
    email: order.customer.email,
    orderCode: order.code
  };
}

export async function resendPendingPaymentEmailByOrderCode(orderCode: string) {
  const order = await prisma.order.findUnique({
    where: {
      code: orderCode
    },
    include: {
      customer: true,
      event: true
    }
  });

  if (!order) {
    throw new Error("Pedido nao encontrado.");
  }

  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("Apenas pedidos pendentes podem receber novo link de pagamento.");
  }

  await sendOrderPendingPaymentEmail({
    to: order.customer.email,
    buyerName: order.customer.name,
    orderCode: order.code,
    eventTitle: order.event.title,
    eventDate: order.event.startsAt,
    venueName: order.event.venueName,
    totalInCents: order.totalInCents,
    expiresAt: order.expiresAt,
    orderUrl: createPublicOrderUrl(order.code)
  });

  return {
    email: order.customer.email,
    orderCode: order.code
  };
}
