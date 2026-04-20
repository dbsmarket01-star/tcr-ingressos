import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateCouponDiscountInCents, getValidCouponForEvent } from "@/features/coupons/coupon.service";
import { createPublicOrderUrl, sendOrderExpiredEmail } from "@/features/email/email.service";
import { calculatePixDiscountInCents, calculateServiceFeeInCents } from "@/features/pricing/pricing";
import { getOrderReservationMinutes } from "@/features/settings/company-settings.service";
import type { CheckoutOrderInput } from "./order.schema";

const FALLBACK_ORDER_RESERVATION_MINUTES = 120;

function createOrderCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TCR-${Date.now().toString(36).toUpperCase()}-${random}`;
}

export async function createCheckoutOrder(input: CheckoutOrderInput) {
  const selectedItems = input.items.filter((item) => item.quantity > 0);
  const reservationMinutes = await getOrderReservationMinutes().catch(() => FALLBACK_ORDER_RESERVATION_MINUTES);

  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: {
          id: input.eventId,
          slug: input.eventSlug,
          status: "PUBLISHED"
        },
        select: {
          id: true
        }
      });

      if (!event) {
        throw new Error("Evento indisponivel para compra.");
      }

      const customer =
        (await tx.customer.findFirst({
          where: {
            email: input.buyerEmail,
            document: input.buyerDocument
          }
        })) ||
        (await tx.customer.create({
          data: {
            name: input.buyerName,
            email: input.buyerEmail,
            document: input.buyerDocument,
            phone: input.buyerPhone || null
          }
        }));

      const orderItems: Array<{
        lotId: string;
        quantity: number;
        unitPriceInCents: number;
        serviceFeeBps: number;
        serviceFeeInCents: number;
        pixDiscountPercentBps: number;
        pixDiscountFixedInCents: number;
        cardInterestBpsPerInstallment: number;
        cardInterestStartsAtInstallment: number;
        totalInCents: number;
      }> = [];

      for (const item of selectedItems) {
        const lot = await tx.ticketLot.findFirst({
          where: {
            id: item.lotId,
            eventId: event.id,
            status: "ACTIVE"
          }
        });

        if (!lot) {
          throw new Error("Lote indisponivel para compra.");
        }

        if (item.quantity < lot.minPerOrder || item.quantity > lot.maxPerOrder) {
          throw new Error(`Quantidade invalida para ${lot.name}.`);
        }

        const now = new Date();

        if (lot.salesStartsAt && lot.salesStartsAt > now) {
          throw new Error(`As vendas de ${lot.name} ainda nao comecaram.`);
        }

        if (lot.salesEndsAt && lot.salesEndsAt < now) {
          throw new Error(`As vendas de ${lot.name} ja encerraram.`);
        }

        const reservedRows = await tx.$executeRaw`
          UPDATE "TicketLot"
          SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}
          WHERE "id" = ${lot.id}
            AND "eventId" = ${event.id}
            AND "status" = 'ACTIVE'
            AND ("totalQuantity" - "soldQuantity" - "reservedQuantity") >= ${item.quantity}
        `;

        if (reservedRows !== 1) {
          throw new Error(`Ingressos insuficientes para ${lot.name}.`);
        }

        const serviceFeeInCents = calculateServiceFeeInCents(
          lot.priceInCents,
          item.quantity,
          lot.serviceFeeBps
        );

        orderItems.push({
          lotId: lot.id,
          quantity: item.quantity,
          unitPriceInCents: lot.priceInCents,
          serviceFeeBps: lot.serviceFeeBps,
          serviceFeeInCents,
          pixDiscountPercentBps: lot.pixDiscountPercentBps,
          pixDiscountFixedInCents: lot.pixDiscountFixedInCents,
          cardInterestBpsPerInstallment: lot.cardInterestBpsPerInstallment,
          cardInterestStartsAtInstallment: lot.cardInterestStartsAtInstallment,
          totalInCents: lot.priceInCents * item.quantity
        });
      }

      const subtotalInCents = orderItems.reduce((sum, item) => sum + item.totalInCents, 0);
      const serviceFeeInCents = orderItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
      const amountBeforeDiscountInCents = subtotalInCents + serviceFeeInCents;
      const coupon = await getValidCouponForEvent(tx, event.id, input.couponCode);
      const discountInCents = coupon
        ? calculateCouponDiscountInCents(coupon, amountBeforeDiscountInCents)
        : 0;
      const pixDiscountInCents = orderItems.reduce(
        (sum, item) =>
          sum +
          calculatePixDiscountInCents(
            item.totalInCents + item.serviceFeeInCents,
            item.quantity,
            item.pixDiscountPercentBps,
            item.pixDiscountFixedInCents
          ),
        0
      );
      const totalInCents = Math.max(amountBeforeDiscountInCents - discountInCents, 0);
      const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);

      const order = await tx.order.create({
        data: {
          code: createOrderCode(),
          eventId: event.id,
          customerId: customer.id,
          couponId: coupon?.id || null,
          couponCode: coupon?.code || null,
          status: OrderStatus.PENDING_PAYMENT,
          subtotalInCents,
          serviceFeeInCents,
          pixDiscountInCents,
          cardInterestInCents: 0,
          discountInCents,
          totalInCents,
          expiresAt,
          utmSource: input.utmSource || null,
          utmMedium: input.utmMedium || null,
          utmCampaign: input.utmCampaign || null,
          utmContent: input.utmContent || null,
          utmTerm: input.utmTerm || null,
          referrer: input.referrer || null,
          landingPage: input.landingPage || null,
          items: {
            create: orderItems.map((item) => ({
              lotId: item.lotId,
              quantity: item.quantity,
              unitPriceInCents: item.unitPriceInCents,
              serviceFeeBps: item.serviceFeeBps,
              serviceFeeInCents: item.serviceFeeInCents,
              cardInterestBpsPerInstallment: item.cardInterestBpsPerInstallment,
              cardInterestStartsAtInstallment: item.cardInterestStartsAtInstallment,
              totalInCents: item.totalInCents
            }))
          },
          payment: {
            create: {
              provider: PaymentProvider.SIMULATED,
              status: PaymentStatus.CREATED,
              amountInCents: totalInCents
            }
          }
        },
        include: {
          customer: {
            select: {
              name: true,
              email: true
            }
          },
          event: {
            select: {
              title: true,
              startsAt: true,
              venueName: true
            }
          }
        }
      });

      return order;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );
}

export async function expirePendingOrders(options?: { limit?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 100;

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt: {
        lt: now
      }
    },
    take: limit,
    orderBy: {
      expiresAt: "asc"
    },
    include: {
      items: true,
      payment: true,
      customer: {
        select: {
          name: true,
          email: true
        }
      },
      event: {
        select: {
          title: true
        }
      }
    }
  });

  let expiredCount = 0;
  let releasedQuantity = 0;

  for (const order of orders) {
    const result = await prisma.$transaction(
      async (tx) => {
        const updatedOrder = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PENDING_PAYMENT,
            expiresAt: {
              lt: now
            }
          },
          data: {
            status: OrderStatus.EXPIRED,
            canceledAt: now
          }
        });

        if (updatedOrder.count !== 1) {
          return { expired: false, released: 0 };
        }

        let released = 0;

        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "TicketLot"
            SET "reservedQuantity" = GREATEST("reservedQuantity" - ${item.quantity}, 0)
            WHERE "id" = ${item.lotId}
          `;
          released += item.quantity;
        }

        if (order.payment && order.payment.status !== PaymentStatus.APPROVED) {
          await tx.payment.update({
            where: {
              id: order.payment.id
            },
            data: {
              status: PaymentStatus.CANCELED,
              failureReason: "Pedido expirado por falta de pagamento."
            }
          });
        }

        return { expired: true, released };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000
      }
    );

    if (result.expired) {
      expiredCount += 1;
      releasedQuantity += result.released;
      await notifyOrderExpired(order);
    }
  }

  return {
    expiredCount,
    releasedQuantity
  };
}

export async function expirePendingOrderByCode(code: string) {
  const order = await prisma.order.findUnique({
    where: { code },
    include: {
      items: true,
      payment: true,
      customer: {
        select: {
          name: true,
          email: true
        }
      },
      event: {
        select: {
          title: true
        }
      }
    }
  });

  if (!order || order.status !== OrderStatus.PENDING_PAYMENT || !order.expiresAt || order.expiresAt >= new Date()) {
    return {
      expiredCount: 0,
      releasedQuantity: 0
    };
  }

  const now = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PENDING_PAYMENT,
          expiresAt: {
            lt: now
          }
        },
        data: {
          status: OrderStatus.EXPIRED,
          canceledAt: now
        }
      });

      if (updatedOrder.count !== 1) {
        return {
          expiredCount: 0,
          releasedQuantity: 0
        };
      }

      let releasedQuantity = 0;

      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "TicketLot"
          SET "reservedQuantity" = GREATEST("reservedQuantity" - ${item.quantity}, 0)
          WHERE "id" = ${item.lotId}
        `;
        releasedQuantity += item.quantity;
      }

      if (order.payment && order.payment.status !== PaymentStatus.APPROVED) {
        await tx.payment.update({
          where: {
            id: order.payment.id
          },
          data: {
            status: PaymentStatus.CANCELED,
            failureReason: "Pedido expirado por falta de pagamento."
          }
        });
      }

      return {
        expiredCount: 1,
        releasedQuantity
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );

  if (result.expiredCount === 1) {
    await notifyOrderExpired(order);
  }

  return result;
}

export async function cancelPendingOrderByCode(code: string, reason = "Cancelado manualmente pela operacao.") {
  const order = await prisma.order.findUnique({
    where: { code },
    include: {
      items: true,
      payment: true
    }
  });

  if (!order) {
    throw new Error("Pedido nao encontrado.");
  }

  if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.EXPIRED) {
    throw new Error("Apenas pedidos pendentes ou expirados podem ser cancelados manualmente por aqui.");
  }

  if (order.payment?.status === PaymentStatus.APPROVED || order.paidAt) {
    throw new Error("Pedido com pagamento aprovado exige fluxo de reembolso/cancelamento financeiro.");
  }

  return prisma.$transaction(
    async (tx) => {
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          status: {
            in: [OrderStatus.PENDING_PAYMENT, OrderStatus.EXPIRED]
          }
        },
        data: {
          status: OrderStatus.CANCELED,
          canceledAt: new Date()
        }
      });

      if (updatedOrder.count !== 1) {
        return {
          canceled: false,
          releasedQuantity: 0
        };
      }

      let releasedQuantity = 0;

      if (order.status === OrderStatus.PENDING_PAYMENT) {
        for (const item of order.items) {
          await tx.$executeRaw`
            UPDATE "TicketLot"
            SET "reservedQuantity" = GREATEST("reservedQuantity" - ${item.quantity}, 0)
            WHERE "id" = ${item.lotId}
          `;
          releasedQuantity += item.quantity;
        }
      }

      if (order.payment && order.payment.status !== PaymentStatus.APPROVED) {
        await tx.payment.update({
          where: {
            id: order.payment.id
          },
          data: {
            status: PaymentStatus.CANCELED,
            failureReason: reason
          }
        });
      }

      return {
        canceled: true,
        releasedQuantity
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );
}

export async function refundPaidOrderByCode(
  code: string,
  reason = "Reembolso registrado manualmente pela operacao."
) {
  const order = await prisma.order.findUnique({
    where: { code },
    include: {
      items: true,
      payment: true,
      tickets: {
        include: {
          checkIns: true
        }
      },
      event: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Pedido nao encontrado.");
  }

  if (order.status !== OrderStatus.PAID) {
    throw new Error("Apenas pedidos pagos podem ser reembolsados por aqui.");
  }

  if (!order.payment || order.payment.status !== PaymentStatus.APPROVED) {
    throw new Error("Este pedido nao possui pagamento aprovado para registrar reembolso.");
  }

  const hasUsedTicket = order.tickets.some(
    (ticket) => ticket.status === "USED" || ticket.checkIns.some((checkIn) => checkIn.status === "APPROVED")
  );

  if (hasUsedTicket) {
    throw new Error("Nao e possivel reembolsar um pedido com ingresso ja utilizado no check-in.");
  }

  return prisma.$transaction(
    async (tx) => {
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.PAID
        },
        data: {
          status: OrderStatus.REFUNDED,
          canceledAt: new Date()
        }
      });

      if (updatedOrder.count !== 1) {
        return {
          refunded: false,
          releasedQuantity: 0,
          canceledTickets: 0,
          eventSlug: order.event.slug
        };
      }

      let releasedQuantity = 0;

      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "TicketLot"
          SET "soldQuantity" = GREATEST("soldQuantity" - ${item.quantity}, 0)
          WHERE "id" = ${item.lotId}
        `;
        releasedQuantity += item.quantity;
      }

      const canceledTickets = order.tickets.length;

      if (canceledTickets > 0) {
        await tx.ticket.updateMany({
          where: {
            orderId: order.id,
            status: {
              in: ["ACTIVE", "INVALID"]
            }
          },
          data: {
            status: "CANCELED",
            canceledAt: new Date()
          }
        });
      }

      const paymentId = order.payment?.id;

      if (!paymentId) {
        throw new Error("Pagamento nao encontrado para registrar o reembolso.");
      }

      await tx.payment.update({
        where: {
          id: paymentId
        },
        data: {
          status: PaymentStatus.REFUNDED,
          failureReason: reason
        }
      });

      return {
        refunded: true,
        releasedQuantity,
        canceledTickets,
        eventSlug: order.event.slug
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );
}

async function notifyOrderExpired(order: {
  id: string;
  code: string;
  expiredEmailSentAt: Date | null;
  customer: {
    name: string;
    email: string;
  };
  event: {
    title: string;
  };
}) {
  if (order.expiredEmailSentAt) {
    return;
  }

  try {
    await sendOrderExpiredEmail({
      to: order.customer.email,
      buyerName: order.customer.name,
      orderCode: order.code,
      eventTitle: order.event.title,
      orderUrl: createPublicOrderUrl(order.code)
    });

    await prisma.order.update({
      where: {
        id: order.id
      },
      data: {
        expiredEmailSentAt: new Date()
      }
    });
  } catch (error) {
    console.error("[email] Falha ao enviar pedido expirado", error);
  }
}

export async function getOrderByCode(code: string) {
  await expirePendingOrderByCode(code);

  return prisma.order.findUnique({
    where: { code },
    include: {
      customer: true,
      event: true,
      payment: true,
      tickets: {
        include: {
          lot: true,
          participant: true
        },
        orderBy: {
          issuedAt: "asc"
        }
      },
      items: {
        include: {
          lot: true
        }
      }
    }
  });
}
