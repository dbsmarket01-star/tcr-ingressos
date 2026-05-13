import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { createAuditLog } from "@/features/audit/audit.service";
import { createHomeListEntriesForApprovedOrder } from "@/features/hospitality/home-list.service";
import { prisma } from "@/lib/prisma";
import { createOrderCode } from "@/features/orders/order.service";
import { createQrCodeToken, createTicketCode } from "@/features/tickets/ticket-code";

export type ManualSalePaymentMethod = "PIX" | "CREDIT_CARD" | "CASH" | "TRANSFER" | "OTHER" | "LEGACY";

export type ManualSaleHotelGuestInput = {
  guestIndex: number;
  guest1Name: string;
  guest1Document: string;
  guest1BirthDate: Date;
  guest1Email: string;
  guest1Phone: string;
  guest2Name: string;
  guest2Document: string;
  guest2BirthDate: Date;
};

export type ManualSaleInput = {
  eventId: string;
  lotId: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  buyerDocument?: string | null;
  buyerPhone?: string | null;
  churchName?: string | null;
  paidAt: Date;
  totalPaidInCents?: number | null;
  serviceFeeInCents?: number | null;
  paymentMethod: ManualSalePaymentMethod;
  sourceLabel?: string | null;
  internalNotes?: string | null;
  hotelGuests?: ManualSaleHotelGuestInput[];
};

type EventScope = string[] | null | undefined;

function allowedEventFilter(allowedEventIds?: EventScope) {
  return allowedEventIds ? { id: { in: allowedEventIds } } : {};
}

function compactText(value?: string | null) {
  return String(value ?? "").trim();
}

function requireText(value: string | null | undefined, message: string) {
  const text = compactText(value);

  if (!text) {
    throw new Error(message);
  }

  return text;
}

function cleanOptionalText(value?: string | null) {
  return compactText(value) || null;
}

function normalizeQuantity(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error("Informe uma quantidade entre 1 e 200 ingressos.");
  }

  return value;
}

function normalizePaidAt(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Informe a data da venda manual.");
  }

  return value;
}

function paymentMethodLabel(method: ManualSalePaymentMethod) {
  const labels: Record<ManualSalePaymentMethod, string> = {
    PIX: "Pix",
    CREDIT_CARD: "Cartao de credito",
    CASH: "Dinheiro",
    TRANSFER: "Transferencia",
    OTHER: "Outro",
    LEGACY: "Sistema antigo"
  };

  return labels[method] ?? "Sistema antigo";
}

function billingTypeForManualMethod(method: ManualSalePaymentMethod) {
  if (method === "PIX" || method === "CREDIT_CARD") {
    return method;
  }

  return "OTHER";
}

function validateGuestDate(date: Date, label: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`Informe ${label}.`);
  }

  return date;
}

function validateHotelGuest(guest: ManualSaleHotelGuestInput, lotName: string) {
  const context = `${lotName} - hospedagem ${guest.guestIndex}`;

  return {
    guestIndex: guest.guestIndex,
    guest1Name: requireText(guest.guest1Name, `Informe o nome do hospede principal em ${context}.`),
    guest1Document: requireText(guest.guest1Document, `Informe o CPF do hospede principal em ${context}.`),
    guest1BirthDate: validateGuestDate(guest.guest1BirthDate, `a data de nascimento do hospede principal em ${context}`),
    guest1Email: requireText(guest.guest1Email, `Informe o e-mail do hospede principal em ${context}.`),
    guest1Phone: requireText(guest.guest1Phone, `Informe o telefone do hospede principal em ${context}.`),
    guest2Name: requireText(guest.guest2Name, `Informe o nome do acompanhante em ${context}.`),
    guest2Document: requireText(guest.guest2Document, `Informe o CPF do acompanhante em ${context}.`),
    guest2BirthDate: validateGuestDate(guest.guest2BirthDate, `a data de nascimento do acompanhante em ${context}`)
  };
}

export async function listManualSaleOptions(organizationId: string, allowedEventIds?: EventScope) {
  return prisma.event.findMany({
    where: {
      organizationId,
      ...allowedEventFilter(allowedEventIds)
    },
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      startsAt: true,
      status: true,
      city: true,
      state: true,
      lots: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          status: true,
          priceInCents: true,
          serviceFeeBps: true,
          totalQuantity: true,
          soldQuantity: true,
          reservedQuantity: true,
          hasHotel: true,
          hotelId: true,
          churchQuestionEnabled: true,
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          }
        }
      }
    }
  });
}

export async function createManualSale(
  input: ManualSaleInput,
  organizationId: string,
  allowedEventIds?: EventScope,
  adminUserId?: string | null
) {
  const quantity = normalizeQuantity(input.quantity);
  const paidAt = normalizePaidAt(input.paidAt);
  const buyerName = requireText(input.buyerName, "Informe o nome do comprador.");
  const buyerEmail = requireText(input.buyerEmail, "Informe o e-mail do comprador.").toLowerCase();
  const buyerDocument = cleanOptionalText(input.buyerDocument);
  const buyerPhone = cleanOptionalText(input.buyerPhone);
  const manualCode = createOrderCode();

  const result = await prisma.$transaction(
    async (tx) => {
      const event = await tx.event.findFirst({
        where: {
          id: input.eventId,
          organizationId,
          ...allowedEventFilter(allowedEventIds)
        },
        select: {
          id: true,
          slug: true,
          title: true
        }
      });

      if (!event) {
        throw new Error("Evento nao encontrado para esta bilheteria.");
      }

      const lot = await tx.ticketLot.findFirst({
        where: {
          id: input.lotId,
          eventId: event.id
        },
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          }
        }
      });

      if (!lot) {
        throw new Error("Ingresso/lote nao encontrado para este evento.");
      }

      const available = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity;

      if (available < quantity) {
        throw new Error(`Este lote tem apenas ${Math.max(available, 0)} ingresso(s) disponivel(is).`);
      }

      if (lot.hasHotel && (!lot.hotelId || !lot.hotel)) {
        throw new Error("Este ingresso possui hotel, mas nenhum hotel esta vinculado ao lote.");
      }

      const hotelGuests = (input.hotelGuests ?? []).sort((left, right) => left.guestIndex - right.guestIndex);

      if (lot.hasHotel && hotelGuests.length !== quantity) {
        throw new Error("Informe os dados de hospedes para cada hospedagem vendida.");
      }

      const validatedHotelGuests = lot.hasHotel
        ? hotelGuests.map((guest) => validateHotelGuest(guest, lot.name))
        : [];
      const defaultSubtotalInCents = lot.priceInCents * quantity;
      const requestedTotalInCents =
        input.totalPaidInCents === null || input.totalPaidInCents === undefined
          ? defaultSubtotalInCents
          : Math.max(input.totalPaidInCents, 0);
      const requestedFeeInCents = Math.max(input.serviceFeeInCents ?? 0, 0);
      const serviceFeeInCents = Math.min(requestedFeeInCents, requestedTotalInCents);
      const subtotalInCents = Math.max(requestedTotalInCents - serviceFeeInCents, 0);
      const unitPriceInCents = quantity > 0 ? Math.round(subtotalInCents / quantity) : 0;

      const updatedRows = await tx.$executeRaw`
        UPDATE "TicketLot"
        SET "soldQuantity" = "soldQuantity" + ${quantity}
        WHERE "id" = ${lot.id}
          AND ("totalQuantity" - "soldQuantity" - "reservedQuantity") >= ${quantity}
      `;

      if (updatedRows !== 1) {
        throw new Error("Nao foi possivel reservar estoque para a venda manual.");
      }

      const customer =
        (await tx.customer.findFirst({
          where: buyerDocument
            ? {
                OR: [{ email: buyerEmail }, { document: buyerDocument }]
              }
            : {
                email: buyerEmail
              }
        })) ||
        (await tx.customer.create({
          data: {
            name: buyerName,
            email: buyerEmail,
            document: buyerDocument,
            phone: buyerPhone
          }
        }));

      if (
        customer.name !== buyerName ||
        (buyerPhone && customer.phone !== buyerPhone) ||
        (buyerDocument && customer.document !== buyerDocument)
      ) {
        await tx.customer.update({
          where: {
            id: customer.id
          },
          data: {
            name: buyerName,
            ...(buyerDocument ? { document: buyerDocument } : {}),
            ...(buyerPhone ? { phone: buyerPhone } : {})
          }
        });
      }

      const order = await tx.order.create({
        data: {
          code: manualCode,
          eventId: event.id,
          customerId: customer.id,
          churchName: cleanOptionalText(input.churchName),
          status: OrderStatus.PAID,
          subtotalInCents,
          serviceFeeInCents,
          pixDiscountInCents: 0,
          cardInterestInCents: 0,
          discountInCents: 0,
          totalInCents: requestedTotalInCents,
          expiresAt: null,
          paidAt,
          createdAt: paidAt,
          utmSource: "venda-manual",
          utmMedium: cleanOptionalText(input.sourceLabel) || "sistema-antigo",
          referrer: "Cadastro manual",
          items: {
            create: [
              {
                lotId: lot.id,
                quantity,
                unitPriceInCents,
                serviceFeeBps: 0,
                serviceFeeInCents,
                cardInterestBpsPerInstallment: 0,
                cardInterestStartsAtInstallment: 2,
                totalInCents: subtotalInCents
              }
            ]
          },
          payment: {
            create: {
              provider: PaymentProvider.SIMULATED,
              status: PaymentStatus.APPROVED,
              externalId: `manual_${manualCode}`,
              amountInCents: requestedTotalInCents,
              paidAt,
              rawPayload: {
                origin: "MANUAL_SALE",
                paymentMethod: input.paymentMethod,
                paymentMethodLabel: paymentMethodLabel(input.paymentMethod),
                billingType: billingTypeForManualMethod(input.paymentMethod),
                sourceLabel: cleanOptionalText(input.sourceLabel),
                internalNotes: cleanOptionalText(input.internalNotes)
              } satisfies Prisma.InputJsonObject
            }
          }
        },
        include: {
          items: {
            select: {
              id: true,
              lotId: true
            }
          }
        }
      });

      const orderItem = order.items[0];

      if (!orderItem) {
        throw new Error("Nao foi possivel criar o item da venda manual.");
      }

      for (let index = 0; index < quantity; index += 1) {
        await tx.ticket.create({
          data: {
            code: createTicketCode(),
            qrCodeToken: createQrCodeToken(),
            orderId: order.id,
            orderItemId: orderItem.id,
            eventId: event.id,
            lotId: lot.id,
            status: "ACTIVE",
            issuedAt: paidAt
          }
        });
      }

      if (lot.hasHotel && lot.hotelId) {
        await tx.orderHotelGuest.createMany({
          data: validatedHotelGuests.map((guest) => ({
            orderId: order.id,
            orderItemId: orderItem.id,
            lotId: lot.id,
            hotelId: lot.hotelId!,
            guestIndex: guest.guestIndex,
            guest1Name: guest.guest1Name,
            guest1Document: guest.guest1Document,
            guest1BirthDate: guest.guest1BirthDate,
            guest1Email: guest.guest1Email,
            guest1Phone: guest.guest1Phone,
            guest2Name: guest.guest2Name,
            guest2Document: guest.guest2Document,
            guest2BirthDate: guest.guest2BirthDate
          }))
        });
      }

      const homeListEntriesCreated = await createHomeListEntriesForApprovedOrder(tx, order.id, paidAt);

      return {
        orderCode: order.code,
        eventSlug: event.slug,
        homeListEntriesCreated
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    }
  );

  await createAuditLog({
    adminUserId,
    action: "MANUAL_SALE_CREATED",
    entityType: "Order",
    entityId: result.orderCode,
    metadata: {
      eventId: input.eventId,
      lotId: input.lotId,
      quantity,
      totalPaidInCents: input.totalPaidInCents ?? null,
      serviceFeeInCents: input.serviceFeeInCents ?? null,
      paymentMethod: input.paymentMethod,
      homeListEntriesCreated: result.homeListEntriesCreated
    }
  });

  return result;
}
