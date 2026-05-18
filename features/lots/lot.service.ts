import { LotStatus, Prisma, TicketLotOptionStatus } from "@prisma/client";
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

function parseTypeOptionLabels(value?: string | null) {
  const labels = String(value ?? "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  const uniqueLabels: string[] = [];
  const seen = new Set<string>();

  for (const label of labels) {
    const normalized = label.toLocaleLowerCase("pt-BR");

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueLabels.push(label.slice(0, 120));
  }

  if (uniqueLabels.length > 200) {
    throw new Error("Cadastre no máximo 200 tipos/camarotes por ingresso.");
  }

  return uniqueLabels;
}

async function syncTicketLotOptions(
  tx: Prisma.TransactionClient,
  lotId: string,
  labels: string[],
  existingOptions: Array<{ id: string; label: string; soldQuantity: number; reservedQuantity: number }> = []
) {
  const labelsSet = new Set(labels.map((label) => label.toLocaleLowerCase("pt-BR")));

  for (const [index, label] of labels.entries()) {
    const existing = existingOptions.find(
      (option) => option.label.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR")
    );

    if (existing) {
      await tx.ticketLotOption.update({
        where: { id: existing.id },
        data: {
          label,
          status: TicketLotOptionStatus.ACTIVE,
          sortOrder: index
        }
      });
      continue;
    }

    await tx.ticketLotOption.create({
      data: {
        lotId,
        label,
        status: TicketLotOptionStatus.ACTIVE,
        sortOrder: index
      }
    });
  }

  for (const option of existingOptions) {
    if (labelsSet.has(option.label.toLocaleLowerCase("pt-BR"))) {
      continue;
    }

    if (option.soldQuantity > 0 || option.reservedQuantity > 0) {
      await tx.ticketLotOption.update({
        where: { id: option.id },
        data: {
          status: TicketLotOptionStatus.PAUSED,
          sortOrder: labels.length + option.soldQuantity + option.reservedQuantity
        }
      });
    } else {
      await tx.ticketLotOption.delete({
        where: { id: option.id }
      });
    }
  }
}

export async function createTicketLot(input: TicketLotInput & { status: LotStatus }) {
  return prisma.$transaction(async (tx) => {
    const salesWindow = await getTicketSalesWindow(tx, input.eventId);
    const hotelId = await resolveHotelIdForLot(tx, input);
    const optionLabels = input.hasTypeOptions ? parseTypeOptionLabels(input.typeOptionsText) : [];

    if (input.hasTypeOptions && optionLabels.length === 0) {
      throw new Error("Informe pelo menos um tipo/camarote para este ingresso.");
    }

    const lot = await tx.ticketLot.create({
      data: {
        eventId: input.eventId,
        hotelId,
        name: input.name,
        description: input.description || null,
        highlightColor: input.highlightColor || null,
        descriptionAsList: input.descriptionAsList,
        hasHotel: input.hasHotel,
        churchQuestionEnabled: input.churchQuestionEnabled,
        hasTypeOptions: input.hasTypeOptions,
        admissionsPerUnit: input.admissionsPerUnit,
        priceInCents: input.priceInCents,
        serviceFeeBps: input.serviceFeeBps,
        pixDiscountPercentBps: input.pixDiscountPercentBps,
        pixDiscountFixedInCents: input.pixDiscountFixedInCents,
        cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
        cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment,
        totalQuantity: input.hasTypeOptions ? optionLabels.length : input.totalQuantity,
        minPerOrder: input.hasTypeOptions ? 1 : input.minPerOrder,
        maxPerOrder: input.hasTypeOptions ? 1 : input.maxPerOrder,
        ...salesWindow,
        status: input.status
      }
    });

    if (input.hasTypeOptions) {
      await syncTicketLotOptions(tx, lot.id, optionLabels);
    }

    return lot;
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
      hotel: true,
      typeOptions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
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
        reservedQuantity: true,
        typeOptions: {
          select: {
            id: true,
            label: true,
            soldQuantity: true,
            reservedQuantity: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!lot) {
      throw new Error("Lote nao encontrado.");
    }

    const minimumQuantity = lot.soldQuantity + lot.reservedQuantity;
    const optionLabels = input.hasTypeOptions ? parseTypeOptionLabels(input.typeOptionsText) : [];
    const totalQuantity = input.hasTypeOptions
      ? Math.max(optionLabels.length, minimumQuantity)
      : input.totalQuantity;

    if (input.hasTypeOptions && optionLabels.length === 0) {
      throw new Error("Informe pelo menos um tipo/camarote para este ingresso.");
    }

    if (totalQuantity < minimumQuantity) {
      throw new Error(`Quantidade total nao pode ser menor que ${minimumQuantity}.`);
    }

    const hotelId = await resolveHotelIdForLot(tx, input);

    const updatedLot = await tx.ticketLot.update({
      where: {
        id: lotId
      },
      data: {
        hotelId,
        name: input.name,
        description: input.description || null,
        highlightColor: input.highlightColor || null,
        descriptionAsList: input.descriptionAsList,
        hasHotel: input.hasHotel,
        churchQuestionEnabled: input.churchQuestionEnabled,
        hasTypeOptions: input.hasTypeOptions,
        admissionsPerUnit: input.admissionsPerUnit,
        priceInCents: input.priceInCents,
        serviceFeeBps: input.serviceFeeBps,
        pixDiscountPercentBps: input.pixDiscountPercentBps,
        pixDiscountFixedInCents: input.pixDiscountFixedInCents,
        cardInterestBpsPerInstallment: input.cardInterestBpsPerInstallment,
        cardInterestStartsAtInstallment: input.cardInterestStartsAtInstallment,
        totalQuantity,
        minPerOrder: input.hasTypeOptions ? 1 : input.minPerOrder,
        maxPerOrder: input.hasTypeOptions ? 1 : input.maxPerOrder,
        ...salesWindow,
        status: input.status
      }
    });

    if (input.hasTypeOptions) {
      await syncTicketLotOptions(tx, lotId, optionLabels, lot.typeOptions);
    } else if (lot.typeOptions.length > 0) {
      const usedOptions = lot.typeOptions.filter((option) => option.soldQuantity > 0 || option.reservedQuantity > 0);
      const unusedOptions = lot.typeOptions.filter((option) => option.soldQuantity <= 0 && option.reservedQuantity <= 0);

      if (usedOptions.length > 0) {
        await tx.ticketLotOption.updateMany({
          where: { id: { in: usedOptions.map((option) => option.id) } },
          data: { status: TicketLotOptionStatus.PAUSED }
        });
      }

      if (unusedOptions.length > 0) {
        await tx.ticketLotOption.deleteMany({
          where: { id: { in: unusedOptions.map((option) => option.id) } }
        });
      }
    }

    return updatedLot;
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
