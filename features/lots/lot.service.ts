import { lockEventLotOrder, normalizeEventLotOrder } from "./lot-order.service";
import { LotStatus, Prisma, TicketLotOptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TicketLotInput, TicketLotPricingInput } from "./lot.schema";
import { ticketLotPricingSchema } from "./lot.schema";
import type { AssistantLotChange } from "@/features/assistant/admin-assistant.service";
import { orderTicketLots } from "./lot-order";

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
    await lockEventLotOrder(tx, input.eventId);
    const salesWindow = await getTicketSalesWindow(tx, input.eventId);
    const hotelId = await resolveHotelIdForLot(tx, input);
    const optionLabels = input.hasTypeOptions ? parseTypeOptionLabels(input.typeOptionsText) : [];

    if (input.hasTypeOptions && optionLabels.length === 0) {
      throw new Error("Informe pelo menos um tipo/camarote para este ingresso.");
    }

    const lastLot = await tx.ticketLot.aggregate({ where: { eventId: input.eventId }, _max: { sortOrder: true } });
    const lot = await tx.ticketLot.create({
      data: {
        eventId: input.eventId,
        sortOrder: (lastLot._max.sortOrder ?? -1) + 1,
        hotelId,
        name: input.name,
        description: input.description || null,
        highlightColor: input.highlightColor || null,
        saleBadge: input.saleBadge,
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

    await normalizeEventLotOrder(tx, input.eventId);
    return tx.ticketLot.findUniqueOrThrow({ where: { id: lot.id } });
  });
}

export async function updateTicketLotStatus(lotId: string, status: LotStatus) {
  return prisma.$transaction(async tx => {
    const lot = await tx.ticketLot.findUniqueOrThrow({ where: { id: lotId } });
    await lockEventLotOrder(tx, lot.eventId);
    await tx.ticketLot.update({
    where: { id: lotId },
    data: {
      status,
      ...(status === LotStatus.SOLD_OUT ? { saleBadge: "SOLD_OUT" } : {}),
      ...(status === LotStatus.ACTIVE ? { saleBadge: "NONE" } : {})
    }
  });
    await normalizeEventLotOrder(tx, lot.eventId);
    return tx.ticketLot.findUniqueOrThrow({ where: { id: lotId } });
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
    await lockEventLotOrder(tx, input.eventId);
    const salesWindow = await getTicketSalesWindow(tx, input.eventId);

    const lot = await tx.ticketLot.findUnique({
      where: {
        id: lotId
      },
      select: {
        eventId: true,
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

    if (!lot || lot.eventId !== input.eventId) {
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
        saleBadge: input.saleBadge,
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

    await normalizeEventLotOrder(tx, input.eventId);
    return tx.ticketLot.findUniqueOrThrow({ where: { id: updatedLot.id } });
  });
}

export async function updateTicketLotPricing(
  lotId: string,
  input: TicketLotPricingInput
) {
  return prisma.$transaction(async tx => {
    const lot = await tx.ticketLot.findUniqueOrThrow({ where: { id: lotId } });
    await lockEventLotOrder(tx, lot.eventId);
    await tx.ticketLot.update({
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
    await normalizeEventLotOrder(tx, lot.eventId);
    return tx.ticketLot.findUniqueOrThrow({ where: { id: lotId } });
  });
}

/** Apply an assistant proposal atomically, with a fresh-state check under the event lock. */
export async function applyAssistantLotChanges(eventId: string, changes: AssistantLotChange[]) {
  return prisma.$transaction(async (tx) => {
    await lockEventLotOrder(tx, eventId);
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { startsAt: true, endsAt: true } });
    const current = await tx.ticketLot.findMany({ where: { eventId } });
    const byId = new Map(current.map((lot) => [lot.id, lot]));
    const touched = new Set<string>();
    const expectedCreated: Array<{ id: string; change: AssistantLotChange; serviceFeeBps: number }> = [];
    for (const change of changes) {
      const source = byId.get(change.operation === "CREATE" ? change.templateLotId : change.lotId);
      const directCreate = change.operation === "CREATE" && !change.templateLotId && current.length === 0;
      if (!source && !directCreate) throw new Error("Ingresso ou modelo não existe mais neste evento.");
      if (change.operation === "UPDATE") {
        if (!source) throw new Error("Ingresso não existe mais neste evento.");
        if (touched.has(source.id)) throw new Error("Ingresso repetido na proposta.");
        touched.add(source.id);
        if (source.name !== change.oldName || (source.description || "") !== change.oldDescription || source.priceInCents !== change.oldPriceInCents || source.totalQuantity !== change.oldTotalQuantity || source.status !== change.oldStatus) throw new Error("O ingresso mudou desde a proposta. Peça nova conferência.");
        if (change.totalQuantity < source.soldQuantity + source.reservedQuantity) throw new Error("Estoque inferior aos ingressos vendidos ou reservados.");
        if (source.hasTypeOptions && change.totalQuantity !== source.totalQuantity) throw new Error("Estoque de ingresso com opções deve ser alterado no cadastro completo.");
      }
      if (!change.name?.trim() || change.name.length > 160 || change.description.length > 4000 || !Number.isSafeInteger(change.totalQuantity) || change.totalQuantity < 1 || !["ACTIVE", "PAUSED", "DRAFT", "SOLD_OUT"].includes(change.status)) throw new Error("Dados do ingresso inválidos.");
      const pricing = ticketLotPricingSchema.safeParse({ priceInCents: change.priceInCents, serviceFeeBps: directCreate ? change.serviceFeeBps : source?.serviceFeeBps, pixDiscountPercentBps: source?.pixDiscountPercentBps, pixDiscountFixedInCents: source?.pixDiscountFixedInCents, cardInterestBpsPerInstallment: directCreate ? change.cardInterestBpsPerInstallment : source?.cardInterestBpsPerInstallment, cardInterestStartsAtInstallment: directCreate ? change.cardInterestStartsAtInstallment : source?.cardInterestStartsAtInstallment });
      if (!pricing.success) throw new Error(pricing.error.issues[0]?.message || "Preço inválido.");
      if (directCreate && (![change.serviceFeeBps, change.cardInterestBpsPerInstallment, change.cardInterestStartsAtInstallment].every(Number.isSafeInteger))) throw new Error("Informe taxa de bilheteria e regras do cartão para o primeiro ingresso.");
      if (change.operation === "UPDATE") {
        if (!source) throw new Error("Ingresso não existe mais neste evento.");
        await tx.ticketLot.update({ where: { id: source.id }, data: { name: change.name.trim(), description: change.description || null, priceInCents: change.priceInCents, totalQuantity: change.totalQuantity, status: change.status, ...(change.status === "ACTIVE" ? { saleBadge: "NONE" } : change.status === "SOLD_OUT" ? { saleBadge: "SOLD_OUT" } : {}) } });
      } else {
        if (source && (source.hasTypeOptions || source.hasHotel || await tx.seatSection.count({ where: { ticketLotId: source.id } }) || await tx.seat.count({ where: { ticketLotId: source.id } }))) throw new Error("Este modelo tem configuração especial; use o cadastro completo de ingressos.");
        const last = await tx.ticketLot.aggregate({ where: { eventId }, _max: { sortOrder: true } });
        const created = await tx.ticketLot.create({ data: { eventId, name: change.name.trim(), description: change.description || null, priceInCents: change.priceInCents, totalQuantity: change.totalQuantity, status: change.status, sortOrder: (last._max.sortOrder ?? -1) + 1, highlightColor: source?.highlightColor || null, saleBadge: "NONE", descriptionAsList: source?.descriptionAsList ?? false, churchQuestionEnabled: source?.churchQuestionEnabled ?? false, admissionsPerUnit: source?.admissionsPerUnit ?? 1, serviceFeeBps: pricing.data.serviceFeeBps, pixDiscountPercentBps: source?.pixDiscountPercentBps ?? 0, pixDiscountFixedInCents: source?.pixDiscountFixedInCents ?? 0, cardInterestBpsPerInstallment: pricing.data.cardInterestBpsPerInstallment, cardInterestStartsAtInstallment: pricing.data.cardInterestStartsAtInstallment, minPerOrder: source?.minPerOrder ?? 1, maxPerOrder: source?.maxPerOrder ?? 10, salesStartsAt: null, salesEndsAt: event.endsAt || event.startsAt } });
        expectedCreated.push({ id: created.id, change, serviceFeeBps: pricing.data.serviceFeeBps });
      }
    }
    await normalizeEventLotOrder(tx, eventId);
    for (const expected of expectedCreated) {
      const saved = await tx.ticketLot.findUniqueOrThrow({ where: { id: expected.id } });
      if (saved.eventId !== eventId || saved.name !== expected.change.name.trim() ||
        saved.priceInCents !== expected.change.priceInCents || saved.totalQuantity !== expected.change.totalQuantity ||
        saved.status !== expected.change.status || saved.serviceFeeBps !== expected.serviceFeeBps) {
        throw new Error("O novo ingresso não corresponde à proposta após a gravação.");
      }
    }
    return tx.ticketLot.findMany({ where: { eventId, status: LotStatus.ACTIVE }, orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
  }, { timeout: 20_000 });
}

/** Reorder visible tickets only; preserve every ticket's identity, sale state and pricing. */
export async function applyAssistantLotOrder(eventId: string, expectedIds: string[], desiredIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await lockEventLotOrder(tx, eventId);
    const lots = await tx.ticketLot.findMany({ where: { eventId }, select: { id: true, name: true, status: true, sortOrder: true, createdAt: true } });
    const visible = orderTicketLots(lots.filter((lot) => lot.status === "ACTIVE" || lot.status === "SOLD_OUT"));
    const currentIds = visible.map((lot) => lot.id);
    if (currentIds.join("|") !== expectedIds.join("|")) throw new Error("A ordem dos ingressos mudou desde a proposta. Peça nova conferência.");
    if (new Set(desiredIds).size !== currentIds.length || desiredIds.length !== currentIds.length ||
      desiredIds.some((id) => !currentIds.includes(id))) throw new Error("A lista proposta não contém exatamente os ingressos visíveis do evento.");
    const hidden = lots.filter((lot) => lot.status !== "ACTIVE" && lot.status !== "SOLD_OUT")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    for (const [sortOrder, id] of [...desiredIds, ...hidden.map((lot) => lot.id)].entries()) {
      await tx.ticketLot.update({ where: { id }, data: { sortOrder } });
    }
    await normalizeEventLotOrder(tx, eventId);
    const verified = await tx.ticketLot.findMany({ where: { eventId, status: { in: [LotStatus.ACTIVE, LotStatus.SOLD_OUT] } },
      orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
    if (verified.map((lot) => lot.id).join("|") !== desiredIds.join("|")) throw new Error("A ordem gravada não corresponde à proposta.");
    if (new Set(verified.map((lot) => lot.sortOrder)).size !== verified.length) throw new Error("A ordem gravada contém posições repetidas.");
    return verified;
  }, { timeout: 20_000 });
}
