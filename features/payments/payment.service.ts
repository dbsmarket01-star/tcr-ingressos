import { HomeListStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPublicTicketUrl, sendTicketsEmail } from "@/features/email/email.service";
import { createHomeListEntriesForApprovedOrder, updateHomeListStatusForOrder } from "@/features/hospitality/home-list.service";
import { expirePendingOrderByCode } from "@/features/orders/order.service";
import {
  MIN_CARD_INSTALLMENT_AMOUNT_IN_CENTS,
  MIN_CARD_PAYMENT_AMOUNT_IN_CENTS,
  MIN_PIX_PAYMENT_AMOUNT_IN_CENTS,
  calculateCardInterestInCents,
  capDiscountToPayableAmount
} from "@/features/pricing/pricing";
import { getCreditCardInstallmentLimitForEvent } from "@/lib/payment-installments";
import { trackMetaPurchaseForPaidOrder } from "@/features/tracking/meta-conversions.service";
import { createQrCodeToken, createTicketCode } from "@/features/tickets/ticket-code";
import { buildAsaasSplitsForOrder } from "./asaas-split.service";
import { getAsaasProvider, getPaymentProvider } from "./payment-provider";
import type { PaymentOrganizationContext } from "./payment-organization-config";
import type { CreditCardPaymentInput as CreditCardFormInput } from "./credit-card.schema";

type WebhookPayload = {
  externalId: string;
  orderCode?: string;
  status: "APPROVED" | "FAILED" | "CANCELED" | "PENDING" | "REFUNDED";
  reason?: string;
  rawPayload?: unknown;
};

type TicketEmailPayload = {
  to: string;
  buyerName: string;
  orderCode: string;
  brandName?: string | null;
  brandPrimaryColor?: string | null;
  organization?: {
    name?: string | null;
    publicDomain?: string | null;
    adminDomain?: string | null;
  } | null;
  eventTitle: string;
  eventDate: Date;
  venueName: string;
  tickets: Array<{
    code: string;
    lotName: string;
    url: string;
  }>;
};

const paymentOrganizationSelect = {
  id: true,
  slug: true,
  name: true
} as const;

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
    return "REFUNDED" as const;
  }

  if (status === "OVERDUE") {
    return "FAILED" as const;
  }

  return "PENDING" as const;
}

function resolveCapturedAmountInCents(
  payment: { amountInCents: number },
  rawPayload?: unknown
) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return payment.amountInCents;
  }

  const value = (rawPayload as { value?: unknown }).value;
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return payment.amountInCents;
  }

  return Math.round(numericValue * 100);
}

export async function startPaymentForOrder(orderCode: string) {
  await expirePendingOrderByCode(orderCode);

  let order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: paymentOrganizationSelect
          }
        }
      },
      payment: true,
      items: true
    }
  });

  if (!order || !order.payment) {
    throw new Error("Pedido nao encontrado.");
  }

  const baseTotalInCents = order.subtotalInCents + order.serviceFeeInCents - order.discountInCents;
  const pixDiscountInCents = capDiscountToPayableAmount(baseTotalInCents, order.pixDiscountInCents);
  const pixTotalInCents = Math.max(baseTotalInCents - pixDiscountInCents, 0);

  if (pixTotalInCents < MIN_PIX_PAYMENT_AMOUNT_IN_CENTS) {
    throw new Error("Não foi possível gerar Pix: o valor mínimo aceito é R$ 10,00. Revise o preço ou desconto Pix do ingresso.");
  }

  if (order.cardInterestInCents > 0 || order.totalInCents !== pixTotalInCents || order.pixDiscountInCents !== pixDiscountInCents) {
    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        cardInterestInCents: 0,
        pixDiscountInCents,
        totalInCents: pixTotalInCents,
        payment: {
          update: {
            amountInCents: pixTotalInCents
          }
        }
      },
      include: {
        customer: true,
        event: {
          include: {
            organization: {
              select: paymentOrganizationSelect
            }
          }
        },
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

  const provider = getPaymentProvider(order.event.organization);
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

export async function findAsaasWebhookOrganization(input: {
  orderCode?: string;
  externalId?: string;
}): Promise<PaymentOrganizationContext | null> {
  const payment = await prisma.payment.findFirst({
    where: input.orderCode
      ? {
          order: {
            code: input.orderCode
          },
          provider: "ASAAS"
        }
      : input.externalId
        ? {
            externalId: input.externalId,
            provider: "ASAAS"
          }
        : {
            id: "__missing__"
          },
    select: {
      order: {
        select: {
          event: {
            select: {
              organization: {
                select: paymentOrganizationSelect
              }
            }
          }
        }
      }
    }
  });

  return payment?.order.event.organization ?? null;
}

export async function syncAsaasPaymentByOrderCode(orderCode: string) {
  const order = await prisma.order.findUnique({
    where: { code: orderCode },
    include: {
      payment: true,
      event: {
        include: {
          organization: {
            select: paymentOrganizationSelect
          }
        }
      }
    }
  });

  if (!order?.payment?.externalId) {
    throw new Error("Pagamento Asaas nao encontrado para este pedido.");
  }

  if (order.payment.provider !== "ASAAS") {
    throw new Error("Este pedido nao usa Asaas.");
  }

  const asaas = getAsaasProvider(order.event.organization);
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
          code: true,
          event: {
            select: {
              organization: {
                select: paymentOrganizationSelect
              }
            }
          }
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

  const asaas = getAsaasProvider(localPayment.order.event.organization);
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
      event: {
        include: {
          organization: {
            select: paymentOrganizationSelect
          }
        }
      },
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

  const maxInstallments = getCreditCardInstallmentLimitForEvent(order.event);

  if (input.installments > maxInstallments) {
    throw new Error(`Este evento permite parcelamento em até ${maxInstallments}x.`);
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

  if (cardTotalInCents < MIN_CARD_PAYMENT_AMOUNT_IN_CENTS) {
    throw new Error("Não foi possível cobrar cartão: o valor mínimo aceito é R$ 5,00. Revise o valor do ingresso.");
  }

  if (Math.ceil(cardTotalInCents / input.installments) < MIN_CARD_INSTALLMENT_AMOUNT_IN_CENTS) {
    throw new Error("Não foi possível cobrar cartão: cada parcela precisa ser de pelo menos R$ 5,00.");
  }

  const asaas = getAsaasProvider(order.event.organization);
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
                select: {
                  title: true,
                  startsAt: true,
                  venueName: true,
                  autoPurchaseApprovedEmailEnabled: true,
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

      const buildApprovedTicketsEmail = (
        tickets: Array<{ code: string; lotName: string }>
      ) => {
        if (
          payment.order.event.autoPurchaseApprovedEmailEnabled === false ||
          tickets.length === 0 ||
          payment.order.ticketsEmailSentAt
        ) {
          return null;
        }

        return {
          to: payment.order.customer.email,
          buyerName: payment.order.customer.name,
          orderCode: payment.order.code,
          brandName: payment.order.event.organization?.name || "Ingresaas",
          brandPrimaryColor: payment.order.event.organization?.primaryColor,
          organization: payment.order.event.organization,
          eventTitle: payment.order.event.title,
          eventDate: payment.order.event.startsAt,
          venueName: payment.order.event.venueName,
          tickets: tickets.map((ticket) => ({
            ...ticket,
            url: createPublicTicketUrl(ticket.code, payment.order.event.organization)
          }))
        };
      };

      if (
        (payment.status === PaymentStatus.APPROVED || payment.order.status === OrderStatus.PAID) &&
        payload.status !== "REFUNDED"
      ) {
        await createHomeListEntriesForApprovedOrder(tx, payment.orderId, new Date());

        const approvedTicketsEmail = buildApprovedTicketsEmail(
          payment.order.tickets.map((ticket) => ({
            code: ticket.code,
            lotName: ticket.lot.name
          }))
        );

        return { payment, orderId: payment.orderId, email: approvedTicketsEmail };
      }

      if (
        payload.status === "REFUNDED" &&
        (payment.status === PaymentStatus.REFUNDED || payment.order.status === OrderStatus.REFUNDED)
      ) {
        return { payment, orderId: payment.orderId, email: null };
      }

      if (
        (payload.status === "FAILED" && payment.status === PaymentStatus.FAILED) ||
        (payload.status === "CANCELED" && payment.status === PaymentStatus.CANCELED)
      ) {
        return { payment, orderId: payment.orderId, email: null };
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
        const capturedAmountInCents = resolveCapturedAmountInCents(payment, payload.rawPayload);
        const paidAt = new Date();

        if (payment.order.status !== OrderStatus.PENDING_PAYMENT) {
          const currentPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
              externalId: payload.externalId || payment.externalId,
              rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
            }
          });

          return {
            payment: currentPayment,
            orderId: payment.orderId,
            email: null
          };
        }

        const claimedPayment = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: {
              in: [PaymentStatus.CREATED, PaymentStatus.PENDING]
            }
          },
          data: {
            status: PaymentStatus.APPROVED,
            externalId: payload.externalId || payment.externalId,
            amountInCents: capturedAmountInCents,
            paidAt,
            failedAt: null,
            failureReason: null,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        if (claimedPayment.count !== 1) {
          const currentPayment = await tx.payment.findUniqueOrThrow({
            where: { id: payment.id }
          });

          return {
            payment: currentPayment,
            orderId: payment.orderId,
            email: null
          };
        }

        for (const item of payment.order.items) {
          const updatedRows = await tx.$executeRaw`
            UPDATE "TicketLot"
            SET
              "reservedQuantity" = "reservedQuantity" - ${item.quantity},
              "soldQuantity" = "soldQuantity" + ${item.quantity}
            WHERE "id" = ${item.lotId}
              AND "reservedQuantity" >= ${item.quantity}
          `;

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

        const claimedOrder = await tx.order.updateMany({
          where: {
            id: payment.orderId,
            status: OrderStatus.PENDING_PAYMENT
          },
          data: {
            status: OrderStatus.PAID,
            totalInCents: capturedAmountInCents,
            paidAt,
            canceledAt: null
          }
        });

        if (claimedOrder.count !== 1) {
          throw new Error("Nao foi possivel confirmar o pedido pago.");
        }

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

        await createHomeListEntriesForApprovedOrder(tx, payment.orderId, paidAt);

        const updatedPayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id }
        });

        return {
          payment: updatedPayment,
          orderId: payment.orderId,
          email: buildApprovedTicketsEmail(generatedTickets)
        };
      }

      if (payload.status === "REFUNDED") {
        const claimedRefund = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: PaymentStatus.APPROVED
          },
          data: {
            status: PaymentStatus.REFUNDED,
            externalId: payload.externalId || payment.externalId,
            failedAt: null,
            failureReason: payload.reason || null,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        if (claimedRefund.count !== 1) {
          const currentPayment = await tx.payment.findUniqueOrThrow({
            where: { id: payment.id }
          });

          return { payment: currentPayment, orderId: payment.orderId, email: null };
        }

        if (payment.order.status === OrderStatus.PAID) {
          for (const item of payment.order.items) {
            await tx.$executeRaw`
              UPDATE "TicketLot"
              SET "soldQuantity" = GREATEST("soldQuantity" - ${item.quantity}, 0)
              WHERE "id" = ${item.lotId}
            `;
          }

          if (payment.order.tickets.length > 0) {
            await tx.ticket.updateMany({
              where: {
                orderId: payment.orderId,
                status: {
                  in: ["ACTIVE", "INVALID", "USED"]
                }
              },
              data: {
                status: "CANCELED",
                canceledAt: new Date()
              }
            });
          }
        }

        await tx.order.updateMany({
          where: {
            id: payment.orderId,
            status: {
              in: [OrderStatus.PAID, OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED, OrderStatus.CANCELED]
            }
          },
          data: {
            status: OrderStatus.REFUNDED,
            canceledAt: new Date()
          }
        });

        await updateHomeListStatusForOrder(tx, payment.orderId, HomeListStatus.CANCELED);

        const updatedPayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id }
        });

        return { payment: updatedPayment, orderId: payment.orderId, email: null };
      }

      if (payload.status === "FAILED" || payload.status === "CANCELED") {
        if (payment.status === PaymentStatus.APPROVED || payment.order.status === OrderStatus.PAID) {
          return { payment, orderId: payment.orderId, email: null };
        }

        const nextPaymentStatus =
          payload.status === "FAILED" ? PaymentStatus.FAILED : PaymentStatus.CANCELED;

        const claimedFailure = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: {
              in: [PaymentStatus.CREATED, PaymentStatus.PENDING]
            }
          },
          data: {
            status: nextPaymentStatus,
            externalId: payload.externalId || payment.externalId,
            failedAt: payload.status === "FAILED" ? new Date() : null,
            failureReason: payload.reason || null,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        if (claimedFailure.count !== 1) {
          const currentPayment = await tx.payment.findUniqueOrThrow({
            where: { id: payment.id }
          });

          return { payment: currentPayment, orderId: payment.orderId, email: null };
        }

        if (payment.order.status === OrderStatus.PENDING_PAYMENT || payment.order.status === OrderStatus.EXPIRED) {
          for (const item of payment.order.items) {
            if (payment.order.status === OrderStatus.PENDING_PAYMENT) {
              await tx.$executeRaw`
                UPDATE "TicketLot"
                SET "reservedQuantity" = GREATEST("reservedQuantity" - ${item.quantity}, 0)
                WHERE "id" = ${item.lotId}
              `;
            }
          }

          await tx.order.updateMany({
            where: {
              id: payment.orderId,
              status: {
                in: [OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED]
              }
            },
            data: {
              status: OrderStatus.CANCELED,
              canceledAt: new Date()
            }
          });
        }

        await updateHomeListStatusForOrder(tx, payment.orderId, HomeListStatus.CANCELED);

        const updatedPayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id }
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
