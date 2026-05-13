import { LotStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TicketLotInput, TicketLotPricingInput } from "./lot.schema";

async function resolveHotelIdForLot(
  tx: Prisma.TransactionClient,
  input: TicketLotInput
) {
  if (!input.hasHotel) {
    return null;
  }

  const event = await tx.event.findUnique({
    where: { id: input.eventId },
    select: {
      organizationId: true
    }
  });

  if (!event) {
    throw new Error("Evento nao encontrado para vincular hotel.");
  }

  if (input.hotelId) {
    const hotel = await tx.hotel.findFirst({
      where: {
        id: input.hotelId,
        organizationId: event.organizationId
      },
      select: {
        id: true
      }
    });

    if (!hotel) {
      throw new Error("Hotel nao encontrado nesta bilheteria.");
    }

    return hotel.id;
  }

  if (!input.newHotelName || !input.newHotelCity || !input.newHotelState) {
    throw new Error("Informe nome, cidade e UF do hotel.");
  }

  const hotel = await tx.hotel.create({
    data: {
      organizationId: event.organizationId,
      name: input.newHotelName,
      city: input.newHotelCity,
      state: input.newHotelState.toUpperCase(),
      internalNotes: input.newHotelInternalNotes || null,
      availableRooms: input.newHotelAvailableRooms ?? null
    },
    select: {
      id: true
    }
  });

  return hotel.id;
}

async function getTicketSalesWindow(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      startsAt: true,
      endsAt: true
    }
  });

  if (!event) {
    throw new Error("Evento nao encontrado para definir as vendas do ingresso.");
  }

  return {
    salesStartsAt: null,
    salesEndsAt: event.endsAt || event.startsAt
  };
}

export async function createTicketLot(input: TicketLotInput & { status: LotStatus }) {
  return prisma.$transaction(async (tx) => {
    const salesWindow = await getTicketSalesWindow(tx, input.eventId);
    const hotelId = await resolveHotelIdForLot(tx, input);

    return tx.ticketLot.create({
      data: {
        eventId: input.eventId,
        hotelId,
        name: input.name,
        description: input.description || null,
        hasHotel: input.hasHotel,
        churchQuestionEnabled: input.churchQuestionEnabled,
        priceInCents: input.priceInCents,
        serviceFeeBps: input.serviceFeeBps,
        pixDiscountPercentBps: input.pixDiscountPercentBps,
        pixDiscountFixedInCents: input.pixDiscountFixedInCents,
        cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
        cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment,
        totalQuantity: input.totalQuantity,
        minPerOrder: input.minPerOrder,
        maxPerOrder: input.maxPerOrder,
        ...salesWindow,
        status: input.status
      }
    });
  });
}

export async function updateTicketLotStatus(lotId: string, status: LotStatus) {
  return prisma.ticketLot.update({
    where: { id: lotId },
    data: { status }
  });
}

export async function getTicketLotForEdit(eventId: string, lotId: string) {
  return prisma.ticketLot.findFirst({
    where: {
      id: lotId,
      eventId
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          endsAt: true,
          organizationId: true
        }
      },
      hotel: true
    }
  });
}

export async function updateTicketLot(lotId: string, input: TicketLotInput & { status: LotStatus }) {
  return prisma.$transaction(async (tx) => {
    const salesWindow = await getTicketSalesWindow(tx, input.eventId);

    const lot = await tx.ticketLot.findUnique({
      where: {
        id: lotId
      },
      select: {
        soldQuantity: true,
        reservedQuantity: true
      }
    });

    if (!lot) {
      throw new Error("Lote nao encontrado.");
    }

    const minimumQuantity = lot.soldQuantity + lot.reservedQuantity;

    if (input.totalQuantity < minimumQuantity) {
      throw new Error(`Quantidade total nao pode ser menor que ${minimumQuantity}.`);
    }

    const hotelId = await resolveHotelIdForLot(tx, input);

    return tx.ticketLot.update({
      where: {
        id: lotId
      },
      data: {
        hotelId,
        name: input.name,
        description: input.description || null,
        hasHotel: input.hasHotel,
        churchQuestionEnabled: input.churchQuestionEnabled,
        priceInCents: input.priceInCents,
        serviceFeeBps: input.serviceFeeBps,
        pixDiscountPercentBps: input.pixDiscountPercentBps,
        pixDiscountFixedInCents: input.pixDiscountFixedInCents,
        cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
        cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment,
        totalQuantity: input.totalQuantity,
        minPerOrder: input.minPerOrder,
        maxPerOrder: input.maxPerOrder,
        ...salesWindow,
        status: input.status
      }
    });
  });
}

export async function updateTicketLotPricing(
  lotId: string,
  input: TicketLotPricingInput
) {
  return prisma.ticketLot.update({
    where: { id: lotId },
    data: {
      priceInCents: input.priceInCents,
      serviceFeeBps: input.serviceFeeBps,
      pixDiscountPercentBps: input.pixDiscountPercentBps,
      pixDiscountFixedInCents: input.pixDiscountFixedInCents,
      cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
      cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment
    }
  });
}
