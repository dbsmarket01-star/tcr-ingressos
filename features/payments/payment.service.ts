import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPublicTicketUrl, sendTicketsEmail } from "@/features/email/email.service";
import { expirePendingOrderByCode } from "@/features/orders/order.service";
import { calculateCardInterestInCents } from "@/features/pricing/pricing";
import { trackMetaPurchaseForPaidOrder } from "@/features/tracking/meta-conversions.service";
import { createQrCodeToken, createTicketCode } from "@/features/tickets/ticket-code";
import { buildAsaasSplitsForOrder } from "./asaas-split.service";
import { getAsaasProvider, getPaymentProvider } from "./payment-provider";
import type { CreditCardPaymentInput as CreditCardFormInput } from "./credit-card.schema";

type WebhookPayload = {
  externalId: string;
  orderCode?: string;
  status: "APPROVED" | "FAILED" | "CANCELED" | "PENDING";
  reason?: string;
  rawPayload?: unknown;
};

type TicketEmailPayload = {
  to: string;
  buyerName: string;
  orderCode: string;
  eventTitle: string;
  eventDate: Date;
  venueName: string;
  tickets: Array<{
    code: string;
    lotName: string;
    url: string;
  }>;
};

export type AsaasExternalPaymentSyncResult =
  | {
      handled: true;
      result: Awaited<ReturnType<typeof handlePaymentWebhook>>;
    }
  | {
      handled: false;
      reason: "not_found";
    };

async function markTicketsEmailSent(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      ticketsEmailSentAt: new Date()
    }
  });
}

async function sendTicketsEmailSafely(orderId: string, email: TicketEmailPayload | null) {
  if (!email) {
    return;
  }

  try {
    await sendTicketsEmail(email);
    await markTicketsEmailSent(orderId);
  } catch (error) {
    console.error("[email] Falha ao enviar ingressos", {
      orderId,
      orderCode: email.orderCode,
      to: email.to,
      error: error instanceof Error ? error.message : error
    });
  }
}

function mapAsaasPaymentStatus(status?: string) {
  if (status === "CONFIRMED" || status === "RECEIVED") {
    return "APPROVED" as const;
  }

  if (status === "REFUNDED") {
    return "CANCELED" as const;
  }

  if (status === "OVERDUE") {
    return "FAILED" as const;
  }

  return "PENDING" as const;
}

export async function startPaymentForOrder(orderCode: string) {
  await expirePendingOrderByCode(orderCode);

  let order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: {
      customer: true,
      event: true,
      payment: true,
      items: true
    }
  });

  if (!order || !order.payment) {
    throw new Error("Pedido nao encontrado.");
  }

  const baseTotalInCents = order.subtotalInCents + order.serviceFeeInCents - order.discountInCents;
  const pixTotalInCents = Math.max(baseTotalInCents - order.pixDiscountInCents, 0);

  if (order.cardInterestInCents > 0 || order.totalInCents !== pixTotalInCents) {
    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        cardInterestInCents: 0,
        totalInCents: pixTotalInCents,
        payment: {
          update: {
            amountInCents: pixTotalInCents
          }
        }
      },
      include: {
        customer: true,
        event: true,
        payment: true,
        items: true
      }
    });
  }

  const orderPayment = order.payment;

  if (!orderPayment) {
    throw new Error("Pagamento nao encontrado.");
  }

  if (
    orderPayment.status === PaymentStatus.PENDING &&
    orderPayment.externalId &&
    (orderPayment.checkoutUrl || orderPayment.pixQrCodePayload)
  ) {
    return {
      order,
      checkoutUrl: orderPayment.checkoutUrl,
      pixQrCodePayload: orderPayment.pixQrCodePayload
    };
  }

  if (order.status !== "PENDING_PAYMENT") {
    if (order.status === OrderStatus.EXPIRED) {
      throw new Error("Este pedido expirou. Volte ao evento e crie uma nova reserva.");
    }

    return {
      order,
      checkoutUrl: orderPayment.checkoutUrl,
      pixQrCodePayload: orderPayment.pixQrCodePayload
    };
  }

  const provider = getPaymentProvider();
  const split = await buildAsaasSplitsForOrder(order.items, order.event.organizationId);
  const intent = await provider.createPaymentIntent({
    orderId: order.id,
    orderCode: order.code,
    amountInCents: pixTotalInCents,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerDocument: order.customer.document,
    customerPhone: order.customer.phone,
    eventTitle: order.event.title,
    eventSlug: order.event.slug,
    split
  });

  const payment = await prisma.payment.update({
    where: { id: orderPayment.id },
    data: {
      provider: intent.provider,
      externalId: intent.externalId,
      checkoutUrl: intent.checkoutUrl || null,
      pixQrCodeImage: intent.pixQrCodeImage || null,
      pixQrCodePayload: intent.pixQrCodePayload || null,
      pixExpiresAt: intent.pixExpiresAt || null,
      amountInCents: pixTotalInCents,
      status: PaymentStatus.PENDING,
      rawPayload: (intent.rawPayload || intent) as Prisma.InputJsonValue
    }
  });

  return {
    order,
    checkoutUrl: payment.checkoutUrl,
    pixQrCodePayload: payment.pixQrCodePayload
  };
}

export async function approvePaymentByOrderCode(orderCode: string) {
  await expirePendingOrderByCode(orderCode);

  const order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: { payment: true }
  });

  if (!order?.payment) {
    throw new Error("Pagamento nao encontrado.");
  }

  if (order.status === OrderStatus.EXPIRED) {
    throw new Error("Este pedido expirou. Crie uma nova reserva para testar pagamento.");
  }

  const externalId = order.payment.externalId || `sim_${order.id}`;

  if (!order.payment.externalId) {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        externalId,
        status: PaymentStatus.PENDING
      }
    });
  }

  return handlePaymentWebhook({
    externalId,
    status: "APPROVED"
  });
}

export async function failPaymentByOrderCode(orderCode: string) {
  await expirePendingOrderByCode(orderCode);

  const order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: { payment: true }
  });

  if (!order?.payment) {
    throw new Error("Pagamento nao encontrado.");
  }

  const externalId = order.payment.externalId || `sim_${order.id}`;

  if (!order.payment.externalId) {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        externalId,
        status: PaymentStatus.PENDING
      }
    });
  }

  return handlePaymentWebhook({
    externalId,
    status: "FAILED",
    reason: "Pagamento simulado como falha."
  });
}

export async function syncAsaasPaymentByOrderCode(orderCode: string) {
  const order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: { payment: true }
  });

  if (!order?.payment?.externalId) {
    throw new Error("Pagamento Asaas nao encontrado para este pedido.");
  }

  if (order.payment.provider !== "ASAAS") {
    throw new Error("Este pedido nao usa Asaas.");
  }

  const asaas = getAsaasProvider();
  const payment = await asaas.getPayment(order.payment.externalId);

  return handlePaymentWebhook({
    externalId: String(payment.id || order.payment.externalId),
    orderCode,
    status: mapAsaasPaymentStatus(payment.status),
    reason: payment.status,
    rawPayload: payment
  });
}

export async function syncAsaasPaymentByExternalId(externalId: string) {
  const localPayment = await prisma.payment.findFirst({
    where: {
      externalId,
      provider: "ASAAS"
    },
    include: {
      order: {
        select: {
          code: true
        }
      }
    }
  });

  if (!localPayment) {
    console.warn("[asaas-webhook] Pagamento externo ignorado por nao existir localmente.", {
      externalId
    });

    return {
      handled: false,
      reason: "not_found"
    } satisfies AsaasExternalPaymentSyncResult;
  }

  const asaas = getAsaasProvider();
  const payment = await asaas.getPayment(externalId);

  const result = await handlePaymentWebhook({
    externalId: String(payment.id || externalId),
    orderCode: localPayment.order.code,
    status: mapAsaasPaymentStatus(payment.status),
    reason: payment.status,
    rawPayload: payment
  });

  return {
    handled: true,
    result
  } satisfies AsaasExternalPaymentSyncResult;
}

export async function payOrderWithAsaasCreditCard(input: CreditCardFormInput & { remoteIp: string }) {
  await expirePendingOrderByCode(input.orderCode);

  const order = await prisma.order.findUnique({
    where: { code: input.orderCode },
    include: {
      customer: true,
      event: true,
      payment: true,
      items: true
    }
  });

  if (!order?.payment) {
    throw new Error("Pedido nao encontrado.");
  }

  if (order.status === OrderStatus.EXPIRED) {
    throw new Error("Este pedido expirou. Volte ao evento e crie uma nova reserva.");
  }

  if (order.status !== "PENDING_PAYMENT") {
    return order.payment;
  }

  const baseTotalInCents = order.subtotalInCents + order.serviceFeeInCents - order.discountInCents;
  const cardInterestInCents = order.items.reduce(
    (sum, item) =>
      sum +
      calculateCardInterestInCents(
        item.totalInCents + item.serviceFeeInCents,
        input.installments,
        item.cardInterestBpsPerInstallment,
        item.cardInterestStartsAtInstallment
      ),
    0
  );
  const cardTotalInCents = baseTotalInCents + cardInterestInCents;

  const asaas = getAsaasProvider();
  const split = await buildAsaasSplitsForOrder(order.items, order.event.organizationId);
  const intent = await asaas.createCreditCardPayment({
    orderId: order.id,
    orderCode: order.code,
    amountInCents: cardTotalInCents,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerDocument: order.customer.document,
    customerPhone: order.customer.phone,
    eventTitle: order.event.title,
    eventSlug: order.event.slug,
    split,
    holderName: input.holderName,
    number: input.number,
    expiryMonth: input.expiryMonth,
    expiryYear: input.expiryYear,
    ccv: input.ccv,
    holderCpfCnpj: input.holderCpfCnpj,
    holderPostalCode: input.holderPostalCode,
    holderAddressNumber: input.holderAddressNumber,
    holderAddressComplement: input.holderAddressComplement,
    installments: input.installments,
    remoteIp: input.remoteIp
  });

  await prisma.payment.update({
    where: { id: order.payment.id },
    data: {
      provider: intent.provider,
      externalId: intent.externalId,
      status: intent.status === "APPROVED" ? PaymentStatus.PENDING : PaymentStatus.PENDING,
      amountInCents: cardTotalInCents,
      checkoutUrl: null,
      pixQrCodeImage: null,
      pixQrCodePayload: null,
      pixExpiresAt: null,
      rawPayload: intent.rawPayload as Prisma.InputJsonValue,
      order: {
        update: {
          cardInterestInCents,
          totalInCents: cardTotalInCents
        }
      }
    }
  });

  return handlePaymentWebhook({
    externalId: intent.externalId,
    orderCode: order.code,
    status: intent.status === "APPROVED" ? "APPROVED" : "PENDING",
    rawPayload: intent.rawPayload
  });
}

export async function handlePaymentWebhook(payload: WebhookPayload) {
  const result = await prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findFirst({
        where: payload.orderCode
          ? {
              order: {
                code: payload.orderCode
              }
            }
          : {
              externalId: payload.externalId
            },
        include: {
          order: {
            select: {
              id: true,
              code: true,
              eventId: true,
              couponId: true,
              status: true,
              ticketsEmailSentAt: true,
              customer: true,
              items: true,
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
                select: {
                  id: true,
                  code: true,
                  lot: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!payment) {
        throw new Error("Pagamento nao encontrado para o webhook.");
      }

      if (payment.status === PaymentStatus.APPROVED || payment.order.status === OrderStatus.PAID) {
        const approvedTicketsEmail =
          payment.order.tickets.length > 0 && !payment.order.ticketsEmailSentAt
            ? {
                to: payment.order.customer.email,
                buyerName: payment.order.customer.name,
                orderCode: payment.order.code,
                brandName: payment.order.event.organization?.name || "TCR Ingressos",
                eventTitle: payment.order.event.title,
                eventDate: payment.order.event.startsAt,
                venueName: payment.order.event.venueName,
                tickets: payment.order.tickets.map((ticket) => ({
                  code: ticket.code,
                  lotName: ticket.lot.name,
                  url: createPublicTicketUrl(ticket.code, payment.order.event.organization)
                }))
              }
            : null;

        return { payment, orderId: payment.orderId, email: approvedTicketsEmail };
      }

      if (payload.status === "PENDING") {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PENDING,
            externalId: payload.externalId || payment.externalId,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        return { payment: updatedPayment, orderId: payment.orderId, email: null };
      }

      if (payload.status === "APPROVED") {
        for (const item of payment.order.items) {
          let updatedRows = await tx.$executeRaw`
            UPDATE "TicketLot"
            SET
              "reservedQuantity" = "reservedQuantity" - ${item.quantity},
              "soldQuantity" = "soldQuantity" + ${item.quantity}
            WHERE "id" = ${item.lotId}
              AND "reservedQuantity" >= ${item.quantity}
          `;

          if (updatedRows !== 1) {
            updatedRows = await tx.$executeRaw`
              UPDATE "TicketLot"
              SET "soldQuantity" = "soldQuantity" + ${item.quantity}
              WHERE "id" = ${item.lotId}
                AND ("totalQuantity" - "soldQuantity" - "reservedQuantity") >= ${item.quantity}
            `;
          }

          if (updatedRows !== 1) {
            throw new Error("Nao foi possivel confirmar o estoque reservado.");
          }
        }

        let generatedTickets: Array<{ code: string; lotName: string }> = [];

        if (payment.order.tickets.length === 0) {
          for (const item of payment.order.items) {
            for (let index = 0; index < item.quantity; index += 1) {
              const ticket = await tx.ticket.create({
                data: {
                  code: createTicketCode(),
                  qrCodeToken: createQrCodeToken(),
                  orderId: payment.orderId,
                  orderItemId: item.id,
                  eventId: payment.order.eventId,
                  lotId: item.lotId,
                  status: "ACTIVE"
                },
                include: {
                  lot: {
                    select: {
                      name: true
                    }
                  }
                }
              });
              generatedTickets.push({
                code: ticket.code,
                lotName: ticket.lot.name
              });
            }
          }
        } else {
          generatedTickets = payment.order.tickets.map((ticket) => ({
            code: ticket.code,
            lotName: ticket.lot.name
          }));
        }

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
            canceledAt: null
          }
        });

        if (payment.order.couponId) {
          await tx.coupon.update({
            where: {
              id: payment.order.couponId
            },
            data: {
              redeemedCount: {
                increment: 1
              }
            }
          });
        }

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.APPROVED,
            externalId: payload.externalId || payment.externalId,
            paidAt: new Date(),
            failedAt: null,
            failureReason: null,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        return {
          payment: updatedPayment,
          orderId: payment.orderId,
          email:
            generatedTickets.length > 0 && !payment.order.ticketsEmailSentAt
              ? {
                  to: payment.order.customer.email,
                  buyerName: payment.order.customer.name,
                  orderCode: payment.order.code,
                  brandName: payment.order.event.organization?.name || "TCR Ingressos",
                  eventTitle: payment.order.event.title,
                  eventDate: payment.order.event.startsAt,
                  venueName: payment.order.event.venueName,
                  tickets: generatedTickets.map((ticket) => ({
                    ...ticket,
                    url: createPublicTicketUrl(ticket.code, payment.order.event.organization)
                  }))
                }
              : null
        };
      }

      if (payload.status === "FAILED" || payload.status === "CANCELED") {
        if (payment.order.status === OrderStatus.PENDING_PAYMENT) {
          for (const item of payment.order.items) {
            await tx.$executeRaw`
              UPDATE "TicketLot"
              SET "reservedQuantity" = GREATEST("reservedQuantity" - ${item.quantity}, 0)
              WHERE "id" = ${item.lotId}
            `;
          }

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: OrderStatus.CANCELED,
              canceledAt: new Date()
            }
          });
        }

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: payload.status === "FAILED" ? PaymentStatus.FAILED : PaymentStatus.CANCELED,
            externalId: payload.externalId || payment.externalId,
            failedAt: payload.status === "FAILED" ? new Date() : null,
            failureReason: payload.reason || null,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        return { payment: updatedPayment, orderId: payment.orderId, email: null };
      }

      return { payment, orderId: payment.orderId, email: null };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );

  await sendTicketsEmailSafely(result.orderId, result.email);

  try {
    await trackMetaPurchaseForPaidOrder(result.orderId);
  } catch (error) {
    console.error("[meta-capi] Falha ao enviar Purchase", {
      orderId: result.orderId,
      externalId: payload.externalId,
      orderCode: payload.orderCode,
      error: error instanceof Error ? error.message : error
    });
  }

  return result.payment;
}
