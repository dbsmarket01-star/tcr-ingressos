import { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createPublicOrderUrl,
  createPublicTicketUrl,
  sendOrderPendingPaymentEmail,
  sendTicketsEmail
} from "@/features/email/email.service";

type EventScope = string[] | null | undefined;

function buildSupportWhere(query: string | undefined, organizationId: string, allowedEventIds?: EventScope) {
  const term = query?.trim();
  const digits = term?.replace(/\D/g, "");

  return {
    event: {
      organizationId,
      status: {
        not: EventStatus.DRAFT
      },
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
    },
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

export async function searchSupportOrders(query: string | undefined, organizationId: string, allowedEventIds?: EventScope) {
  return prisma.order.findMany({
    where: buildSupportWhere(query, organizationId, allowedEventIds),
    orderBy: {
      createdAt: "desc"
    },
    take: 30,
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true,
              adminDomain: true,
              primaryColor: true
            }
          }
        }
      },
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

export async function resendTicketsEmailByOrderCode(
  orderCode: string,
  organizationId: string,
  allowedEventIds?: EventScope
) {
  const order = await prisma.order.findFirst({
    where: {
      code: orderCode,
      event: {
        organizationId,
        status: {
          not: EventStatus.DRAFT
        }
      },
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true,
              primaryColor: true
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
    brandName: order.event.organization?.name || "Ingresaas",
    brandPrimaryColor: order.event.organization?.primaryColor,
    organization: order.event.organization,
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

export async function resendPendingPaymentEmailByOrderCode(
  orderCode: string,
  organizationId: string,
  allowedEventIds?: EventScope
) {
  const order = await prisma.order.findFirst({
    where: {
      code: orderCode,
      event: {
        organizationId,
        status: {
          not: EventStatus.DRAFT
        }
      },
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true,
              primaryColor: true
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
    brandName: order.event.organization?.name || "Ingresaas",
    brandPrimaryColor: order.event.organization?.primaryColor,
    organization: order.event.organization,
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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function findPublicOrdersByCustomerEmail(email: string, organizationId: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return [];
  }

  return prisma.order.findMany({
    where: {
      event: {
        organizationId,
        status: {
          not: EventStatus.DRAFT
        }
      },
      customer: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive"
        }
      },
      status: {
        in: ["PAID", "PENDING_PAYMENT"]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 12,
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              name: true,
              publicDomain: true,
              primaryColor: true
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
}

export async function resendPublicAccessEmailsByCustomerEmail(email: string, organizationId: string) {
  const orders = await findPublicOrdersByCustomerEmail(email, organizationId);

  if (orders.length === 0) {
    throw new Error("Não encontramos compras com esse e-mail nesta operação.");
  }

  let sentTickets = 0;
  let sentPending = 0;

  for (const order of orders) {
    if (order.status === "PAID" && order.tickets.length > 0) {
      await sendTicketsEmail({
        to: order.customer.email,
        buyerName: order.customer.name,
        orderCode: order.code,
        brandName: order.event.organization?.name || "Ingresaas",
        brandPrimaryColor: order.event.organization?.primaryColor,
        organization: order.event.organization,
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

      sentTickets += 1;
      continue;
    }

    if (order.status === "PENDING_PAYMENT") {
      await sendOrderPendingPaymentEmail({
        to: order.customer.email,
        buyerName: order.customer.name,
        orderCode: order.code,
        brandName: order.event.organization?.name || "Ingresaas",
        brandPrimaryColor: order.event.organization?.primaryColor,
        organization: order.event.organization,
        eventTitle: order.event.title,
        eventDate: order.event.startsAt,
        venueName: order.event.venueName,
        totalInCents: order.totalInCents,
        expiresAt: order.expiresAt,
        orderUrl: createPublicOrderUrl(order.code, order.event.organization)
      });

      sentPending += 1;
    }
  }

  if (sentTickets === 0 && sentPending === 0) {
    throw new Error("Não há ingressos emitidos ou pedidos recuperáveis para esse e-mail.");
  }

  return {
    email: normalizeEmail(email),
    ordersFound: orders.length,
    sentTickets,
    sentPending
  };
}
