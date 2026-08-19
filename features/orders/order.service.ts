import { EventStatus, HomeListStatus, OrderStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateCouponDiscountInCents,
  calculateCouponEligibleAmountInCents,
  getValidCouponForEvent
} from "@/features/coupons/coupon.service";
import { createPublicOrderUrl, sendOrderExpiredEmail } from "@/features/email/email.service";
import { updateHomeListStatusForOrder } from "@/features/hospitality/home-list.service";
import { getHotelRoomsPerUnit } from "@/features/hospitality/hotel-lot-rules";
import { calculatePixDiscountInCents, calculateServiceFeeInCents } from "@/features/pricing/pricing";
import {
  finalizeOrganizationPublicPriceInCents,
  getEffectiveFixedOrderFeeInCents,
  getEffectiveServiceFeeBps,
  isFeeFreeOrganization
} from "@/features/pricing/organization-pricing-policy";
import { releaseSeatReservationsForOrder, releaseSoldSeatsForOrder, reserveSeatsForOrderItem } from "@/features/seat-maps/seat-map.service";
import { getOrderReservationMinutes } from "@/features/settings/company-settings.service";
import { calculateAsaasSplitsForOrder, sumAsaasSplitsInCents } from "@/features/payments/asaas-split.service";
import { sendCartAbandonmentWhatsApp } from "@/features/whatsapp/whatsapp.service";
import { isValidCpf, onlyDocumentDigits } from "@/lib/document-validation";
import type { CheckoutOrderInput } from "./order.schema";

const FALLBACK_ORDER_RESERVATION_MINUTES = 120;
const DEFAULT_CART_ABANDONMENT_DELAY_SECONDS = 10 * 60;
type CheckoutHotelGuestInput = NonNullable<CheckoutOrderInput["hotelGuests"]>[number];

export function createOrderCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ING-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function compactText(value?: string | null) {
  return String(value ?? "").trim();
}

function onlyDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function getCartAbandonmentDelayMs() {
  const rawValue =
    process.env.WHATSAPP_CART_ABANDONMENT_FIRST_DELAY_SECONDS ||
    process.env.CART_ABANDONMENT_FIRST_DELAY_SECONDS;
  const seconds = Number(rawValue);

  if (!rawValue || !Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_CART_ABANDONMENT_DELAY_SECONDS * 1000;
  }

  return Math.max(30, Math.floor(seconds)) * 1000;
}

function formatCartAbandonmentSummary(
  items: Array<{
    quantity: number;
    lot: {
      name: string;
    };
    lotOption?: {
      label: string;
    } | null;
  }>
) {
  const totalTickets = items.reduce((sum, item) => sum + item.quantity, 0);
  const firstItem = items[0];
  const quantityLabel = `${String(totalTickets).padStart(2, "0")} ${totalTickets === 1 ? "ingresso" : "ingressos"}`;

  if (!firstItem) {
    return quantityLabel;
  }

  const sector = firstItem.lotOption?.label || firstItem.lot.name;
  return `${quantityLabel} no setor ${sector}`;
}

function compactState(value?: string | null) {
  return compactText(value).slice(0, 2).toUpperCase() || null;
}

function requiredHotelField(value: string | undefined, message: string) {
  const text = compactText(value);

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function parseHotelBirthDate(value: string | undefined, message: string) {
  const text = requiredHotelField(value, message);
  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }

  return date;
}

function requiredHotelCpf(value: string | undefined, message: string) {
  const text = requiredHotelField(value, message);

  if (!isValidCpf(text)) {
    throw new Error(message);
  }

  return onlyDocumentDigits(text);
}

async function reserveTicketLotOption(
  tx: Prisma.TransactionClient,
  lotId: string,
  lotOptionId: string,
  lotName: string
) {
  const option = await tx.ticketLotOption.findFirst({
    where: {
      id: lotOptionId,
      lotId,
      status: "ACTIVE"
    },
    select: {
      id: true,
      label: true
    }
  });

  if (!option) {
    throw new Error(`Selecione um tipo disponível para ${lotName}.`);
  }

  const reservedRows = await tx.$executeRaw`
    UPDATE "TicketLotOption"
    SET "reservedQuantity" = "reservedQuantity" + 1
    WHERE "id" = ${option.id}
      AND "lotId" = ${lotId}
      AND "status" = 'ACTIVE'
      AND ("soldQuantity" + "reservedQuantity") = 0
  `;

  if (reservedRows !== 1) {
    throw new Error(`${option.label} acabou de ser reservado por outra pessoa. Escolha outro tipo.`);
  }

  return option;
}

async function releaseReservedTicketLotOption(
  tx: Prisma.TransactionClient,
  lotOptionId: string | null | undefined,
  quantity: number
) {
  if (!lotOptionId) {
    return;
  }

  await tx.$executeRaw`
    UPDATE "TicketLotOption"
    SET "reservedQuantity" = GREATEST("reservedQuantity" - ${quantity}, 0)
    WHERE "id" = ${lotOptionId}
  `;
}

async function confirmReservedTicketLotOption(
  tx: Prisma.TransactionClient,
  lotOptionId: string | null | undefined,
  quantity: number
) {
  if (!lotOptionId) {
    return;
  }

  const updatedRows = await tx.$executeRaw`
    UPDATE "TicketLotOption"
    SET
      "reservedQuantity" = "reservedQuantity" - ${quantity},
      "soldQuantity" = "soldQuantity" + ${quantity}
    WHERE "id" = ${lotOptionId}
      AND "reservedQuantity" >= ${quantity}
  `;

  if (updatedRows !== 1) {
    throw new Error("Nao foi possivel confirmar o tipo/camarote reservado.");
  }
}

async function sellTicketLotOptionWithoutReservation(
  tx: Prisma.TransactionClient,
  lotOptionId: string | null | undefined,
  quantity: number
) {
  if (!lotOptionId) {
    return;
  }

  const updatedRows = await tx.$executeRaw`
    UPDATE "TicketLotOption"
    SET "soldQuantity" = "soldQuantity" + ${quantity}
    WHERE "id" = ${lotOptionId}
      AND "reservedQuantity" = 0
      AND "soldQuantity" = 0
  `;

  if (updatedRows !== 1) {
    throw new Error("O tipo/camarote selecionado ja nao esta disponivel.");
  }
}

async function releaseSoldTicketLotOption(
  tx: Prisma.TransactionClient,
  lotOptionId: string | null | undefined,
  quantity: number
) {
  if (!lotOptionId) {
    return;
  }

  await tx.$executeRaw`
    UPDATE "TicketLotOption"
    SET "soldQuantity" = GREATEST("soldQuantity" - ${quantity}, 0)
    WHERE "id" = ${lotOptionId}
  `;
}

export async function createCheckoutOrder(input: CheckoutOrderInput, organizationId?: string | null) {
  const selectedItems = input.items.filter((item) => item.quantity > 0);
  const buyerCity = compactText(input.buyerCity).slice(0, 100);
  const buyerState = compactState(input.buyerState);
  const buyerPostalCode = onlyDigits(input.buyerPostalCode).slice(0, 8);
  const buyerNeighborhood = compactText(input.buyerNeighborhood).slice(0, 100);
  const reservationMinutes = await getOrderReservationMinutes(organizationId || undefined).catch(
    () => FALLBACK_ORDER_RESERVATION_MINUTES
  );

  return prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: {
          id: input.eventId,
          slug: input.eventSlug,
          ...(organizationId ? { organizationId } : {}),
          status: "PUBLISHED"
        },
        select: {
          id: true,
          organizationId: true,
          organization: {
            select: {
              slug: true
            }
          },
          couponsEnabled: true
        }
      });

      if (!event) {
        throw new Error("Evento indisponivel para compra.");
      }

      const existingCustomer = await tx.customer.findFirst({
        where: {
          email: input.buyerEmail,
          document: input.buyerDocument
        }
      });
      const customer = existingCustomer
        ? await tx.customer.update({
            where: {
              id: existingCustomer.id
            },
            data: {
              name: input.buyerName,
              phone: input.buyerPhone || existingCustomer.phone,
              city: buyerCity || existingCustomer.city,
              state: buyerState || existingCustomer.state,
              postalCode: buyerPostalCode || existingCustomer.postalCode,
              neighborhood: buyerNeighborhood || existingCustomer.neighborhood
            }
          })
        : await tx.customer.create({
            data: {
              name: input.buyerName,
              email: input.buyerEmail,
              document: input.buyerDocument,
              phone: input.buyerPhone || null,
              city: buyerCity || null,
              state: buyerState,
              postalCode: buyerPostalCode || null,
              neighborhood: buyerNeighborhood || null
            }
          });

      const orderItems: Array<{
        lotId: string;
        lotOptionId?: string | null;
        seatIds: string[];
        quantity: number;
        unitPriceInCents: number;
        serviceFeeBps: number;
        serviceFeeInCents: number;
        pixDiscountPercentBps: number;
        pixDiscountFixedInCents: number;
        cardInterestBpsPerInstallment: number;
        cardInterestStartsAtInstallment: number;
        hasHotel: boolean;
        admissionsPerUnit: number;
        totalInCents: number;
      }> = [];
      const hotelGuestsToCreate: Array<{
        lotId: string;
        hotelId: string;
        guestIndex: number;
        guest1Name: string;
        guest1Document: string;
        guest1BirthDate: Date;
        guest1Email: string;
        guest1Phone: string;
        guest2Name: string;
        guest2Document: string;
        guest2BirthDate: Date;
      }> = [];
      const hotelGuestsByLot = new Map<string, Map<number, CheckoutHotelGuestInput>>();
      let churchQuestionEnabledForOrder = false;

      for (const guest of input.hotelGuests ?? []) {
        if (!hotelGuestsByLot.has(guest.lotId)) {
          hotelGuestsByLot.set(guest.lotId, new Map());
        }

        hotelGuestsByLot.get(guest.lotId)!.set(guest.guestIndex, guest);
      }

      for (const item of selectedItems) {
        const lot = await tx.ticketLot.findFirst({
          where: {
            id: item.lotId,
            eventId: event.id,
            status: "ACTIVE",
            saleBadge: {
              not: "SOLD_OUT"
            }
          },
          include: {
            hotel: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        if (!lot) {
          throw new Error("Lote indisponivel para compra.");
        }

        if (item.quantity < lot.minPerOrder || item.quantity > lot.maxPerOrder) {
          throw new Error(`Quantidade invalida para ${lot.name}.`);
        }

        const selectedSeatIds = Array.from(new Set(item.seatIds ?? []));

        if (selectedSeatIds.length > 0 && selectedSeatIds.length !== item.quantity) {
          throw new Error(`A quantidade de assentos selecionados nao confere com ${lot.name}.`);
        }

        let lotOption: { id: string; label: string } | null = null;

        if (lot.hasTypeOptions) {
          if (item.quantity !== 1) {
            throw new Error(`Selecione apenas um tipo por pedido para ${lot.name}.`);
          }

          if (!item.lotOptionId) {
            throw new Error(`Selecione um tipo disponível para ${lot.name}.`);
          }

          lotOption = await reserveTicketLotOption(tx, lot.id, item.lotOptionId, lot.name);
        } else if (item.lotOptionId) {
          throw new Error(`O ingresso ${lot.name} nao possui tipos/camarotes configurados.`);
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

        const effectiveServiceFeeBps = getEffectiveServiceFeeBps(
          event.organization?.slug,
          lot.serviceFeeBps
        );
        const serviceFeeInCents = calculateServiceFeeInCents(
          lot.priceInCents,
          item.quantity,
          effectiveServiceFeeBps
        );

        orderItems.push({
          lotId: lot.id,
          lotOptionId: lotOption?.id || null,
          seatIds: selectedSeatIds,
          quantity: item.quantity,
          unitPriceInCents: lot.priceInCents,
          serviceFeeBps: effectiveServiceFeeBps,
          serviceFeeInCents,
          pixDiscountPercentBps: lot.pixDiscountPercentBps,
          pixDiscountFixedInCents: lot.pixDiscountFixedInCents,
          cardInterestBpsPerInstallment: lot.cardInterestBpsPerInstallment,
          cardInterestStartsAtInstallment: lot.cardInterestStartsAtInstallment,
          hasHotel: lot.hasHotel,
          admissionsPerUnit: Math.max(lot.admissionsPerUnit, 1),
          totalInCents: lot.priceInCents * item.quantity
        });

        if (lot.churchQuestionEnabled) {
          churchQuestionEnabledForOrder = true;
        }

        if (lot.hasHotel) {
          if (!lot.hotelId || !lot.hotel) {
            throw new Error(`O ingresso ${lot.name} está marcado com hotel, mas nenhum hotel foi vinculado.`);
          }

          const guestsForLot = hotelGuestsByLot.get(lot.id);

          const hotelRoomCount = item.quantity * getHotelRoomsPerUnit(lot);

          for (let guestIndex = 1; guestIndex <= hotelRoomCount; guestIndex += 1) {
            const guest = guestsForLot?.get(guestIndex);
            const context = `${lot.name} - hospedagem ${guestIndex}`;

            hotelGuestsToCreate.push({
              lotId: lot.id,
              hotelId: lot.hotelId,
              guestIndex,
              guest1Name: requiredHotelField(guest?.guest1Name || input.buyerName, `Informe o nome do hóspede principal em ${context}.`),
              guest1Document: requiredHotelCpf(guest?.guest1Document || input.buyerDocument, `Informe um CPF válido para o hóspede principal em ${context}.`),
              guest1BirthDate: parseHotelBirthDate(guest?.guest1BirthDate, `Informe a data de nascimento do hóspede principal em ${context}.`),
              guest1Email: requiredHotelField(guest?.guest1Email || input.buyerEmail, `Informe o e-mail do hóspede principal em ${context}.`),
              guest1Phone: requiredHotelField(guest?.guest1Phone || input.buyerPhone, `Informe o telefone do hóspede principal em ${context}.`),
              guest2Name: requiredHotelField(guest?.guest2Name, `Informe o nome do acompanhante em ${context}.`),
              guest2Document: requiredHotelCpf(guest?.guest2Document, `Informe um CPF válido para o acompanhante em ${context}.`),
              guest2BirthDate: parseHotelBirthDate(guest?.guest2BirthDate, `Informe a data de nascimento do acompanhante em ${context}.`)
            });
          }
        }
      }

      const subtotalInCents = orderItems.reduce((sum, item) => sum + item.totalInCents, 0);
      let serviceFeeInCents = orderItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
      const configuredServiceFeeInCents = serviceFeeInCents;
      const couponEligibleAmountInCents = calculateCouponEligibleAmountInCents(subtotalInCents, 0);
      if (input.couponCode && !event.couponsEnabled) {
        throw new Error("Este evento não aceita cupom de desconto.");
      }
      const coupon = event.couponsEnabled
        ? await getValidCouponForEvent(tx, event.id, input.couponCode)
        : null;
      const discountInCents = coupon
        ? calculateCouponDiscountInCents(coupon, couponEligibleAmountInCents, orderItems)
        : 0;
      const [splitRules, feeSettings] = await Promise.all([
        tx.paymentSplitRule.findMany({
          where: { organizationId: event.organizationId, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }),
        tx.companySettings.findUnique({
          where: { organizationId: event.organizationId },
          select: { pixTransactionFeeInCents: true }
        })
      ]);
      const isFeeFree = isFeeFreeOrganization(event.organization?.slug);
      const checkoutSplits = calculateAsaasSplitsForOrder(
        orderItems,
        isFeeFree ? [] : splitRules,
        { discountInCents }
      );
      const fixedOrderFeeInCents = getEffectiveFixedOrderFeeInCents(
        event.organization?.slug,
        feeSettings?.pixTransactionFeeInCents ?? 200
      );
      const unroundedServiceFeeInCents = Math.max(configuredServiceFeeInCents, sumAsaasSplitsInCents(checkoutSplits)) + fixedOrderFeeInCents;
      const roundedTotalInCents = finalizeOrganizationPublicPriceInCents(
        event.organization?.slug,
        subtotalInCents + unroundedServiceFeeInCents - discountInCents
      );
      serviceFeeInCents = roundedTotalInCents - subtotalInCents + discountInCents;
      const originalItemServiceFeeInCents = orderItems.reduce((sum, item) => sum + item.serviceFeeInCents, 0);
      if (orderItems[0]) {
        orderItems[0].serviceFeeInCents += serviceFeeInCents - originalItemServiceFeeInCents;
      }
      const pixDiscountInCents = orderItems.reduce(
        (sum, item) =>
          sum +
          calculatePixDiscountInCents(
            item.totalInCents,
            item.quantity,
            item.pixDiscountPercentBps,
            item.pixDiscountFixedInCents
          ),
        0
      );
      const totalInCents = roundedTotalInCents;
      const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);

      const order = await tx.order.create({
        data: {
          code: createOrderCode(),
          eventId: event.id,
          customerId: customer.id,
          couponId: coupon?.id || null,
          couponCode: coupon?.code || null,
          churchName: churchQuestionEnabledForOrder ? compactText(input.churchName).slice(0, 120) || null : null,
          status: OrderStatus.PENDING_PAYMENT,
          subtotalInCents,
          serviceFeeInCents,
          pixDiscountInCents,
          cardInterestInCents: 0,
          discountInCents,
          totalInCents,
          buyerCity: buyerCity || null,
          buyerState,
          buyerPostalCode: buyerPostalCode || null,
          buyerNeighborhood: buyerNeighborhood || null,
          expiresAt,
          utmSource: input.utmSource || null,
          utmMedium: input.utmMedium || null,
          utmCampaign: input.utmCampaign || null,
          utmContent: input.utmContent || null,
          utmTerm: input.utmTerm || null,
          referrer: input.referrer || null,
          landingPage: input.landingPage || null,
          metaFbp: input.metaFbp || null,
          metaFbc: input.metaFbc || null,
          clientIpAddress: input.clientIpAddress || null,
          clientUserAgent: input.clientUserAgent || null,
          items: {
            create: orderItems.map((item) => ({
              lotId: item.lotId,
              lotOptionId: item.lotOptionId || null,
              quantity: item.quantity,
              admissionsPerUnit: item.admissionsPerUnit,
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
          items: {
            select: {
              id: true,
              lotId: true
            }
          },
          customer: {
            select: {
              name: true,
              email: true
            }
          },
          event: {
            select: {
              organization: {
                select: {
                  name: true,
                  publicDomain: true,
                  primaryColor: true
                }
              },
              autoPendingPaymentEmailEnabled: true,
              title: true,
              startsAt: true,
              venueName: true
            }
          }
        }
      });

      const orderItemsByLotId = new Map(order.items.map((item) => [item.lotId, item.id]));

      for (const item of orderItems) {
        if (item.seatIds.length === 0) {
          continue;
        }

        const orderItemId = orderItemsByLotId.get(item.lotId);

        if (!orderItemId) {
          throw new Error("Não foi possível vincular os assentos ao item do pedido.");
        }

        await reserveSeatsForOrderItem({
          tx,
          eventId: event.id,
          orderId: order.id,
          orderItemId,
          lotId: item.lotId,
          seatIds: item.seatIds,
          expiresAt
        });
      }

      if (hotelGuestsToCreate.length > 0) {
        await tx.orderHotelGuest.createMany({
          data: hotelGuestsToCreate.map((guest) => {
            const orderItemId = orderItemsByLotId.get(guest.lotId);

            if (!orderItemId) {
              throw new Error("Não foi possível vincular os hóspedes ao item do pedido.");
            }

            return {
              orderId: order.id,
              orderItemId,
              lotId: guest.lotId,
              hotelId: guest.hotelId,
              guestIndex: guest.guestIndex,
              guest1Name: guest.guest1Name,
              guest1Document: guest.guest1Document,
              guest1BirthDate: guest.guest1BirthDate,
              guest1Email: guest.guest1Email,
              guest1Phone: guest.guest1Phone,
              guest2Name: guest.guest2Name,
              guest2Document: guest.guest2Document,
              guest2BirthDate: guest.guest2BirthDate
            };
          })
        });
      }

      return order;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );
}

export async function expirePendingOrders(options?: {
  limit?: number;
  now?: Date;
  organizationId?: string | null;
  allowedEventIds?: string[] | null;
}) {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 100;
  const allowedEventIds = options?.allowedEventIds;
  const organizationId = options?.organizationId;

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      ...(organizationId
        ? {
            event: {
              organizationId,
              status: {
                not: EventStatus.DRAFT
              }
            }
          }
        : {}),
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {}),
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
          title: true,
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
          await releaseReservedTicketLotOption(tx, item.lotOptionId, item.quantity);
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

        await updateHomeListStatusForOrder(tx, order.id, HomeListStatus.CANCELED);
        await releaseSeatReservationsForOrder(tx, order.id, now);

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

export async function sendCartAbandonmentReminders(options?: {
  limit?: number;
  now?: Date;
  organizationId?: string | null;
}) {
  const now = options?.now ?? new Date();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const minimumCreatedAt = new Date(now.getTime() - getCartAbandonmentDelayMs());
  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      cartAbandonmentSentAt: null,
      createdAt: {
        lte: minimumCreatedAt
      },
      expiresAt: {
        gt: now
      },
      ...(options?.organizationId
        ? {
            event: {
              organizationId: options.organizationId,
              status: {
                not: EventStatus.DRAFT
              }
            }
          }
        : {})
    },
    orderBy: {
      createdAt: "asc"
    },
    take: limit,
    include: {
      items: {
        select: {
          quantity: true,
          lot: {
            select: {
              name: true
            }
          },
          lotOption: {
            select: {
              label: true
            }
          }
        }
      },
      customer: {
        select: {
          name: true,
          phone: true
        }
      },
      event: {
        select: {
          title: true,
          organization: {
            select: {
              id: true,
              name: true,
              publicDomain: true,
              adminDomain: true
            }
          }
        }
      }
    }
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  function shouldStopRetryingCartAbandonment(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return message.includes("API access blocked") || message.includes("WhatsApp Business API nao configurada");
  }

  for (const order of orders) {
    if (!order.customer.phone || !order.expiresAt) {
      skipped += 1;
      continue;
    }

    try {
      const claimed = await prisma.order.updateMany({
        where: {
          id: order.id,
          cartAbandonmentSentAt: null
        },
        data: {
          cartAbandonmentSentAt: new Date()
        }
      });

      if (claimed.count === 0) {
        skipped += 1;
        continue;
      }

      await sendCartAbandonmentWhatsApp({
        buyerName: order.customer.name,
        buyerPhone: order.customer.phone,
        eventTitle: order.event.title,
        orderUrl: createPublicOrderUrl(order.code, order.event.organization),
        expiresAt: order.expiresAt,
        organizationId: order.event.organization?.id,
        eventId: order.eventId,
        orderId: order.id
      });

      sent += 1;
    } catch (error) {
      failed += 1;

      if (!shouldStopRetryingCartAbandonment(error)) {
        await prisma.order.updateMany({
          where: {
            id: order.id
          },
          data: {
            cartAbandonmentSentAt: null
          }
        });
      }

      console.error("[WhatsApp] Falha ao enviar abandono de carrinho", {
        orderId: order.id,
        orderCode: order.code,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    checked: orders.length,
    sent,
    skipped,
    failed
  };
}

export async function expirePendingOrderByCode(code: string, organizationId?: string | null) {
  const order = await prisma.order.findFirst({
    where: {
      code,
      ...(organizationId
        ? {
            event: {
              organizationId,
              status: {
                not: EventStatus.DRAFT
              }
            }
          }
        : {})
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
          title: true,
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
        await releaseReservedTicketLotOption(tx, item.lotOptionId, item.quantity);
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

      await updateHomeListStatusForOrder(tx, order.id, HomeListStatus.CANCELED);
      await releaseSeatReservationsForOrder(tx, order.id, new Date());

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

export async function cancelPendingOrderByCode(
  code: string,
  reason = "Cancelado manualmente pela operacao.",
  allowedEventIds?: string[] | null,
  organizationId?: string | null
) {
  const order = await prisma.order.findFirst({
    where: {
      code,
      ...(organizationId
        ? {
            event: {
              organizationId,
              status: {
                not: EventStatus.DRAFT
              }
            }
          }
        : {}),
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
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
          await releaseReservedTicketLotOption(tx, item.lotOptionId, item.quantity);
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

      await updateHomeListStatusForOrder(tx, order.id, HomeListStatus.CANCELED);
      await releaseSeatReservationsForOrder(tx, order.id, new Date());

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
  reason = "Reembolso registrado manualmente pela operacao.",
  allowedEventIds?: string[] | null,
  organizationId?: string | null
) {
  const order = await prisma.order.findFirst({
    where: {
      code,
      ...(organizationId
        ? {
            event: {
              organizationId,
              status: {
                not: EventStatus.DRAFT
              }
            }
          }
        : {}),
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
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
        await releaseSoldTicketLotOption(tx, item.lotOptionId, item.quantity);
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

      await updateHomeListStatusForOrder(tx, order.id, HomeListStatus.CANCELED);
      await releaseSoldSeatsForOrder(tx, order.id);

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
    organization: {
      name: string;
      publicDomain: string | null;
      primaryColor: string | null;
    } | null;
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
      brandName: order.event.organization?.name || "Ingresaas",
      brandPrimaryColor: order.event.organization?.primaryColor,
      organization: order.event.organization,
      eventTitle: order.event.title,
      orderUrl: createPublicOrderUrl(order.code, order.event.organization)
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

export async function getOrderByCode(code: string, organizationId?: string | null) {
  await expirePendingOrderByCode(code, organizationId);

  return prisma.order.findFirst({
    where: {
      code,
      ...(organizationId
        ? {
            event: {
              organizationId,
              status: {
                not: EventStatus.DRAFT
              }
            }
          }
        : {})
    },
    include: {
      customer: true,
      event: {
        include: {
          organization: {
            select: {
              slug: true,
              name: true,
              publicDomain: true,
              primaryColor: true
            }
          }
        }
      },
      payment: true,
      tickets: {
        include: {
          lot: true,
          lotOption: true,
          participant: true
        },
        orderBy: {
          issuedAt: "asc"
        }
      },
      items: {
        include: {
          lot: true,
          lotOption: true
        }
      }
    }
  });
}
