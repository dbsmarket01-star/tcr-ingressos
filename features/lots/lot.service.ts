import { LotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TicketLotInput, TicketLotPricingInput } from "./lot.schema";

export async function createTicketLot(input: TicketLotInput & { status: LotStatus }) {
  return prisma.ticketLot.create({
    data: {
      eventId: input.eventId,
      name: input.name,
      description: input.description || null,
      priceInCents: input.priceInCents,
      serviceFeeBps: input.serviceFeeBps,
      pixDiscountPercentBps: input.pixDiscountPercentBps,
      pixDiscountFixedInCents: input.pixDiscountFixedInCents,
      cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
      cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment,
      totalQuantity: input.totalQuantity,
      minPerOrder: input.minPerOrder,
      maxPerOrder: input.maxPerOrder,
      salesStartsAt: input.salesStartsAt || null,
      salesEndsAt: input.salesEndsAt || null,
      status: input.status
    }
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
          slug: true
        }
      }
    }
  });
}

export async function updateTicketLot(lotId: string, input: TicketLotInput & { status: LotStatus }) {
  const lot = await prisma.ticketLot.findUnique({
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

  return prisma.ticketLot.update({
    where: {
      id: lotId
    },
    data: {
      name: input.name,
      description: input.description || null,
      priceInCents: input.priceInCents,
      serviceFeeBps: input.serviceFeeBps,
      pixDiscountPercentBps: input.pixDiscountPercentBps,
      pixDiscountFixedInCents: input.pixDiscountFixedInCents,
      cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
      cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment,
      totalQuantity: input.totalQuantity,
      minPerOrder: input.minPerOrder,
      maxPerOrder: input.maxPerOrder,
      salesStartsAt: input.salesStartsAt || null,
      salesEndsAt: input.salesEndsAt || null,
      status: input.status
    }
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
