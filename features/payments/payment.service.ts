import { HomeListStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPublicOrderUrl, createPublicTicketUrl, sendTicketsEmail, type EmailSendResult } from "@/features/email/email.service";
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
import { sendPurchaseApprovedWhatsApp, type PurchaseApprovedWhatsAppInput } from "@/features/whatsapp/whatsapp.service";
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

type PurchaseApprovedWhatsAppPayload = PurchaseApprovedWhatsAppInput;

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

const FAILED_TICKET_EMAIL_STATUSES = new Set(["failed", "bounced", "complained", "suppressed"]);

function normalizeEmailError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function markTicketsEmailSent(orderId: string, result: EmailSendResult | undefined) {
  const checkedAt = new Date();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      ticketsEmailSentAt: checkedAt,
      ticketsEmailProviderId: result?.providerId ?? null,
      ticketsEmailStatus: result?.status ?? "accepted",
      ticketsEmailLastCheckedAt: checkedAt,
      ticketsEmailLastError: null,
      ticketsEmailAttempts: {
        increment: 1
      }
    }
  });
}

async function markTicketsEmailFailed(orderId: string, error: unknown) {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      ticketsEmailStatus: "failed",
      ticketsEmailLastCheckedAt: new Date(),
      ticketsEmailLastError: normalizeEmailError(error),
      ticketsEmailAttempts: {
        increment: 1
      }
    }
  });
}

async function sendTicketsEmailSafely(orderId: string, email: TicketEmailPayload | null) {
  if (!email) {
    return;
  }

  try {
    const result = await sendTicketsEmail(email);
    await markTicketsEmailSent(orderId, result);
  } catch (error) {
    await markTicketsEmailFailed(orderId, error).catch((recordError) => {
      console.error("[email] Falha ao registrar erro de envio dos ingressos", {
        orderId,
        orderCode: email.orderCode,
        error: normalizeEmailError(recordError)
      });
    });
    console.error("[email] Falha ao enviar ingressos", {
      orderId,
      orderCode: email.orderCode,
      to: email.to,
      error: normalizeEmailError(error)
    });
  }
}

async function sendPurchaseApprovedWhatsAppSafely(orderId: string, payload: PurchaseApprovedWhatsAppPayload | null) {
  if (!payload) {
    return;
  }

  await sendPurchaseApprovedWhatsApp(payload)
    .then(async () => {
      await prisma.order.update({
        where: {
          id: orderId
        },
        data: {
          purchaseApprovedWhatsAppSentAt: new Date()
        }
      });
    })
    .catch((error) => {
      console.error("[WhatsApp] Falha ao enviar compra aprovada", {
        orderId,
        orderCode: payload.orderCode,
        error: normalizeEmailError(error)
      });
    });
}

function mapAsaasPaymentStatus(status?: string) {
  const normalizedStatus = status?.trim().toUpperCase();

  if (
    normalizedStatus === "REFUNDED" ||
    normalizedStatus === "CHARGEBACK_REQUESTED" ||
    normalizedStatus === "CHARGEBACK_DISPUTE" ||
    normalizedStatus === "CHARGEBACK"
  ) {
    return "REFUNDED" as const;
  }

  if (normalizedStatus === "CONFIRMED" || normalizedStatus === "RECEIVED") {
    return "APPROVED" as const;
  }

  if (normalizedStatus === "OVERDUE" || normalizedStatus === "REFUSED" || normalizedStatus === "REPROVED") {
    return "FAILED" as const;
  }

  if (normalizedStatus === "DELETED" || normalizedStatus === "CANCELED" || normalizedStatus === "CANCELLED") {
    return "CANCELED" as const;
  }

  return "PENDING" as const;
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

function numberToCents(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.round(numericValue * 100);
}

function isInstallmentPaymentPayload(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);

  if (!payload) {
    return false;
  }

  const installmentCount = payload.installmentCount;
  const description = typeof payload.description === "string" ? payload.description : "";

  return Boolean(
    payload.installment ||
      payload.installmentNumber ||
      payload.installmentValue ||
      (typeof installmentCount === "number" && installmentCount > 1) ||
      /parcela/i.test(description)
  );
}

function resolveCapturedAmountInCents(
  payment: { amountInCents: number },
  rawPayload?: unknown
) {
  const payload = extractPaymentPayload(rawPayload);
  const valueInCents = numberToCents(payload?.value);

  if (valueInCents === null) {
    return payment.amountInCents;
  }

  return valueInCents;
}

function resolveCommercialOrderTotalInCents(order: {
  totalInCents: number;
  subtotalInCents: number;
  serviceFeeInCents: number;
  pixDiscountInCents: number;
  cardInterestInCents: number;
  discountInCents: number;
}) {
  const calculatedCardTotalInCents = Math.max(
    order.subtotalInCents + order.serviceFeeInCents + order.cardInterestInCents - order.discountInCents,
    0
  );
  const calculatedPixTotalInCents = Math.max(calculatedCardTotalInCents - order.pixDiscountInCents, 0);

  return Math.max(order.totalInCents, calculatedCardTotalInCents, calculatedPixTotalInCents);
}

function resolveApprovedAmountInCents(
  payment: { amountInCents: number },
  order: {
    totalInCents: number;
    subtotalInCents: number;
    serviceFeeInCents: number;
    pixDiscountInCents: number;
    cardInterestInCents: number;
    discountInCents: number;
  },
  rawPayload?: unknown
) {
  const capturedAmountInCents = resolveCapturedAmountInCents(payment, rawPayload);

  if (!isInstallmentPaymentPayload(rawPayload)) {
    return capturedAmountInCents;
  }

  return Math.max(payment.amountInCents, resolveCommercialOrderTotalInCents(order), capturedAmountInCents);
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

export type AsaasPaymentReconciliationResult = {
  checked: number;
  synced: number;
  approved: number;
  pending: number;
  failed: number;
  refunded: number;
  skipped: number;
  errors: Array<{
    orderCode: string;
    externalId: string;
    message: string;
  }>;
};

type ReconcileAsaasPaymentsOptions = {
  limit?: number;
  lookbackHours?: number;
  organizationId?: string | null;
};

export async function reconcileAsaasPayments(
  options?: ReconcileAsaasPaymentsOptions
): Promise<AsaasPaymentReconciliationResult> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const lookbackHours = Math.min(Math.max(options?.lookbackHours ?? 72, 1), 24 * 30);
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const payments = await prisma.payment.findMany({
    where: {
      provider: "ASAAS",
      externalId: {
        not: null
      },
      createdAt: {
        gte: since
      },
      ...(options?.organizationId
        ? {
            order: {
              event: {
                organizationId: options.organizationId
              }
            }
          }
        : {}),
      OR: [
        {
          status: {
            in: [
              PaymentStatus.CREATED,
              PaymentStatus.PENDING,
              PaymentStatus.CANCELED,
              PaymentStatus.FAILED,
              PaymentStatus.APPROVED
            ]
          }
        },
        {
          order: {
            status: {
              in: [OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED, OrderStatus.CANCELED, OrderStatus.PAID]
            }
          }
        }
      ]
    },
    orderBy: {
      updatedAt: "asc"
    },
    take: limit,
    include: {
      order: {
        select: {
          code: true,
          status: true,
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

  const result: AsaasPaymentReconciliationResult = {
    checked: 0,
    synced: 0,
    approved: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
    skipped: 0,
    errors: []
  };

  for (const localPayment of payments) {
    const externalId = localPayment.externalId;

    if (!externalId) {
      result.skipped += 1;
      continue;
    }

    result.checked += 1;

    try {
      const asaas = getAsaasProvider(localPayment.order.event.organization);
      const remotePayment = await asaas.getPayment(externalId);
      const nextStatus = mapAsaasPaymentStatus(remotePayment.status);

      if (
        nextStatus === "PENDING" &&
        localPayment.order.status !== OrderStatus.PENDING_PAYMENT &&
        localPayment.status !== PaymentStatus.PENDING
      ) {
        result.pending += 1;
        result.skipped += 1;
        continue;
      }

      await handlePaymentWebhook({
        externalId: String(remotePayment.id || externalId),
        orderCode: localPayment.order.code,
        status: nextStatus,
        reason: remotePayment.status,
        rawPayload: remotePayment
      });

      result.synced += 1;

      if (nextStatus === "APPROVED") {
        result.approved += 1;
      } else if (nextStatus === "REFUNDED") {
        result.refunded += 1;
      } else if (nextStatus === "FAILED" || nextStatus === "CANCELED") {
        result.failed += 1;
      } else {
        result.pending += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      result.errors.push({
        orderCode: localPayment.order.code,
        externalId,
        message
      });

      console.error("[asaas-reconcile] Falha ao reconciliar pagamento.", {
        orderCode: localPayment.order.code,
        externalId,
        error: message
      });
    }
  }

  return result;
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
              subtotalInCents: true,
              serviceFeeInCents: true,
              pixDiscountInCents: true,
              cardInterestInCents: true,
              discountInCents: true,
              totalInCents: true,
              ticketsEmailSentAt: true,
              ticketsEmailStatus: true,
              purchaseApprovedWhatsAppSentAt: true,
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
          payment.order.ticketsEmailSentAt &&
          !FAILED_TICKET_EMAIL_STATUSES.has(payment.order.ticketsEmailStatus || "")
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

      const buildApprovedWhatsApp = () => {
        if (payment.order.purchaseApprovedWhatsAppSentAt || !payment.order.customer.phone) {
          return null;
        }

        return {
          buyerName: payment.order.customer.name,
          buyerPhone: payment.order.customer.phone,
          eventTitle: payment.order.event.title,
          orderCode: payment.order.code,
          orderUrl: createPublicOrderUrl(payment.order.code, payment.order.event.organization)
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

        return { payment, orderId: payment.orderId, email: approvedTicketsEmail, whatsapp: buildApprovedWhatsApp() };
      }

      if (
        payload.status === "REFUNDED" &&
        (payment.status === PaymentStatus.REFUNDED || payment.order.status === OrderStatus.REFUNDED)
      ) {
        return { payment, orderId: payment.orderId, email: null, whatsapp: null };
      }

      if (payment.status === PaymentStatus.REFUNDED || payment.order.status === OrderStatus.REFUNDED) {
        const currentPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            externalId: payload.externalId || payment.externalId,
            rawPayload: (payload.rawPayload || payload) as Prisma.InputJsonValue
          }
        });

        return { payment: currentPayment, orderId: payment.orderId, email: null, whatsapp: null };
      }

      if (
        (payload.status === "FAILED" && payment.status === PaymentStatus.FAILED) ||
        (payload.status === "CANCELED" && payment.status === PaymentStatus.CANCELED)
      ) {
        return { payment, orderId: payment.orderId, email: null, whatsapp: null };
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

        return { payment: updatedPayment, orderId: payment.orderId, email: null, whatsapp: null };
      }

      if (payload.status === "APPROVED") {
        const approvedAmountInCents = resolveApprovedAmountInCents(payment, payment.order, payload.rawPayload);
        const paidAt = new Date();

        const canConfirmApprovedOrder =
          payment.order.status === OrderStatus.PENDING_PAYMENT ||
          payment.order.status === OrderStatus.EXPIRED ||
          payment.order.status === OrderStatus.CANCELED;

        if (!canConfirmApprovedOrder) {
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
            email: null,
            whatsapp: null
          };
        }

        const claimablePaymentStatuses =
          payment.order.status === OrderStatus.EXPIRED || payment.order.status === OrderStatus.CANCELED
            ? [PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.CANCELED, PaymentStatus.FAILED]
            : [PaymentStatus.CREATED, PaymentStatus.PENDING];

        const claimedPayment = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: {
              in: claimablePaymentStatuses
            }
          },
          data: {
            status: PaymentStatus.APPROVED,
            externalId: payload.externalId || payment.externalId,
            amountInCents: approvedAmountInCents,
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
            email: null,
            whatsapp: null
          };
        }

        const shouldConsumeReservation = payment.order.status === OrderStatus.PENDING_PAYMENT;

        for (const item of payment.order.items) {
          const updatedRows = shouldConsumeReservation
            ? await tx.$executeRaw`
                UPDATE "TicketLot"
                SET
                  "reservedQuantity" = "reservedQuantity" - ${item.quantity},
                  "soldQuantity" = "soldQuantity" + ${item.quantity}
                WHERE "id" = ${item.lotId}
                  AND "reservedQuantity" >= ${item.quantity}
              `
            : await tx.$executeRaw`
                UPDATE "TicketLot"
                SET "soldQuantity" = "soldQuantity" + ${item.quantity}
                WHERE "id" = ${item.lotId}
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
            status: {
              in: [OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED, OrderStatus.CANCELED]
            }
          },
          data: {
            status: OrderStatus.PAID,
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
          email: buildApprovedTicketsEmail(generatedTickets),
          whatsapp: buildApprovedWhatsApp()
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

          return { payment: currentPayment, orderId: payment.orderId, email: null, whatsapp: null };
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

        return { payment: updatedPayment, orderId: payment.orderId, email: null, whatsapp: null };
      }

      if (payload.status === "FAILED" || payload.status === "CANCELED") {
        if (payment.status === PaymentStatus.APPROVED || payment.order.status === OrderStatus.PAID) {
          return { payment, orderId: payment.orderId, email: null, whatsapp: null };
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

          return { payment: currentPayment, orderId: payment.orderId, email: null, whatsapp: null };
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

        return { payment: updatedPayment, orderId: payment.orderId, email: null, whatsapp: null };
      }

      return { payment, orderId: payment.orderId, email: null, whatsapp: null };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );

  await sendTicketsEmailSafely(result.orderId, result.email);
  await sendPurchaseApprovedWhatsAppSafely(result.orderId, result.whatsapp);

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
