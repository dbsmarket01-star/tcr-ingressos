import { OrderStatus, Prisma, SeatStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createTableSeats,
  createTheaterSeats,
  type SeatMapKind,
  type SeatMapLayout,
  type SeatMapSeat,
  type SeatMapSeatStatus,
  type SeatMapTableShape
} from "./seat-map";

type Tx = Prisma.TransactionClient;

export type NumberedSeatMapInput = {
  kind: SeatMapKind;
  seatingMode: "WITH_TABLES" | "SEATS_ONLY";
  seatsPerTable: number;
  tablesPerSection?: number | null;
  tableShape: SeatMapTableShape;
};

type EventLotForSeatMap = {
  id: string;
  name: string;
  priceInCents: number;
  totalQuantity: number;
};

type GeneratedSection = {
  lot: EventLotForSeatMap;
  name: string;
  color: string;
  description?: string;
  priority?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  seats: Array<SeatMapSeat & {
    tableLabel?: string | null;
    tableShape?: SeatMapTableShape | null;
  }>;
};

type MapDimensions = {
  width: number;
  height: number;
};

type SectionGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const sectionColors = ["#ffc107", "#a7b0b7", "#7c3aed", "#4f9f46", "#0ea5e9", "#f97316"];
const tableCellSize = 92;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getMapDimensions(kind: SeatMapKind) {
  if (kind === "OVAL") {
    return { width: 1280, height: 900 };
  }

  if (kind === "RESTAURANT") {
    return { width: 1180, height: 880 };
  }

  return { width: 1200, height: 840 };
}

function getTableCountForLot(lot: EventLotForSeatMap, input: NumberedSeatMapInput) {
  const seatsPerTable = clamp(input.seatsPerTable, 1, 20);
  return input.tablesPerSection ? clamp(input.tablesPerSection, 1, 500) : Math.max(1, Math.ceil(lot.totalQuantity / seatsPerTable));
}

function getTableColumns(sectionWidth: number, tableCount: number) {
  return clamp(Math.floor(sectionWidth / tableCellSize), 1, Math.max(1, tableCount));
}

function getDynamicMapDimensions(kind: SeatMapKind, lots: EventLotForSeatMap[], input: NumberedSeatMapInput): MapDimensions {
  const base = getMapDimensions(kind);

  if (input.seatingMode !== "WITH_TABLES") {
    return base;
  }

  const top = kind === "RESTAURANT" ? 160 : 190;
  const bottomPadding = 90;
  const sectionGap = 28;
  const totalHeight = lots.reduce((sum, lot, index) => {
    const inset = kind === "OVAL" ? 120 + index * 22 : 80 + index * 16;
    const sectionWidth = base.width - inset * 2;
    const tableCount = getTableCountForLot(lot, input);
    const columns = getTableColumns(sectionWidth, tableCount);
    const rows = Math.max(1, Math.ceil(tableCount / columns));
    return sum + Math.max(170, rows * tableCellSize + 58);
  }, top + bottomPadding + sectionGap * Math.max(lots.length - 1, 0));

  return {
    width: base.width,
    height: Math.max(base.height, totalHeight)
  };
}

function getSeatMapKindLabel(kind: SeatMapKind) {
  if (kind === "THEATER") return "Teatro / Auditório";
  if (kind === "ARENA") return "Arena / Galeria";
  if (kind === "OVAL") return "Oval / Circular";
  if (kind === "RESTAURANT") return "Mesas / Restaurante";
  return "Personalizado";
}

function buildSectionGeometry(index: number, total: number, kind: SeatMapKind, dimensions: MapDimensions, sectionHeight?: number) {
  const { width, height } = dimensions;
  const top = kind === "RESTAURANT" ? 160 : 190;
  const bottomPadding = 70;
  const sectionGap = 26;
  const availableHeight = height - top - bottomPadding - sectionGap * Math.max(total - 1, 0);
  const computedSectionHeight = sectionHeight ?? clamp(availableHeight / Math.max(total, 1), 130, 260);
  const inset = kind === "OVAL" ? 120 + index * 22 : 80 + index * 16;

  return {
    x: inset,
    y: top + index * (computedSectionHeight + sectionGap),
    width: width - inset * 2,
    height: computedSectionHeight
  };
}

function buildTableSection(
  lot: EventLotForSeatMap,
  sectionIndex: number,
  input: NumberedSeatMapInput,
  geometry: SectionGeometry
): GeneratedSection {
  const seatsPerTable = clamp(input.seatsPerTable, 1, 20);
  const tableCount = getTableCountForLot(lot, input);
  const maxSeatsForSection = Math.min(lot.totalQuantity, tableCount * seatsPerTable);
  const columns = getTableColumns(geometry.width, tableCount);
  const rows = Math.max(1, Math.ceil(tableCount / columns));
  const cellWidth = geometry.width / columns;
  const cellHeight = geometry.height / rows;
  const tableWidth = input.tableShape === "RECTANGLE" ? Math.min(58, cellWidth * 0.36) : Math.min(40, cellWidth * 0.34);
  const tableHeight = input.tableShape === "RECTANGLE" ? Math.min(38, cellHeight * 0.34) : Math.min(40, cellHeight * 0.34);
  const seats: GeneratedSection["seats"] = [];
  let generatedSeats = 0;

  for (let tableIndex = 0; tableIndex < tableCount; tableIndex += 1) {
    const row = Math.floor(tableIndex / columns);
    const column = tableIndex % columns;
    const tableLabel = String(tableIndex + 1).padStart(tableCount >= 10 ? 2 : 1, "0");
    const tableId = `section-${sectionIndex + 1}-table-${tableLabel}`;
    const x = Math.round(geometry.x + column * cellWidth + cellWidth / 2 - tableWidth / 2);
    const y = Math.round(geometry.y + row * cellHeight + cellHeight / 2 - tableHeight / 2);
    const remainingSeats = maxSeatsForSection - generatedSeats;
    const seatsForThisTable = Math.min(seatsPerTable, remainingSeats);

    if (seatsForThisTable <= 0) {
      break;
    }

    createTableSeats({
      tableId,
      sectionId: `section-${sectionIndex + 1}`,
      tableLabel,
      x,
      y,
      width: tableWidth,
      height: tableHeight,
      shape: input.tableShape,
      seats: seatsForThisTable,
      priceInCents: lot.priceInCents
    }).forEach((seat) => {
      seats.push({
        ...seat,
        tableLabel,
        tableShape: input.tableShape
      });
      generatedSeats += 1;
    });
  }

  return {
    lot,
    name: lot.name,
    color: sectionColors[sectionIndex % sectionColors.length],
    ...geometry,
    seats
  };
}

function buildSeatOnlySection(
  lot: EventLotForSeatMap,
  sectionIndex: number,
  totalSections: number,
  input: NumberedSeatMapInput,
  dimensions: MapDimensions
): GeneratedSection {
  const geometry = buildSectionGeometry(sectionIndex, totalSections, input.kind, dimensions);
  const columns = clamp(Math.ceil(Math.sqrt(lot.totalQuantity * (geometry.width / Math.max(geometry.height, 1)))), 8, 38);
  const rows = Math.ceil(lot.totalQuantity / columns);
  const columnGap = Math.max(18, Math.floor(geometry.width / Math.max(columns, 1)));
  const rowGap = Math.max(20, Math.floor(geometry.height / Math.max(rows, 1)));
  const seats = createTheaterSeats({
    sectionId: `section-${sectionIndex + 1}`,
    x: geometry.x + Math.round(columnGap / 2),
    y: geometry.y + Math.round(rowGap / 2),
    rows,
    columns,
    rowGap,
    columnGap,
    priceInCents: lot.priceInCents
  }).slice(0, lot.totalQuantity);

  return {
    lot,
    name: lot.name,
    color: sectionColors[sectionIndex % sectionColors.length],
    ...geometry,
    seats
  };
}

function buildGeneratedSections(lots: EventLotForSeatMap[], input: NumberedSeatMapInput, dimensions: MapDimensions) {
  if (input.seatingMode !== "WITH_TABLES") {
    return lots.map((lot, index) => buildSeatOnlySection(lot, index, lots.length, input, dimensions));
  }

  const top = input.kind === "RESTAURANT" ? 160 : 190;
  const sectionGap = 28;
  let currentY = top;

  return lots.map((lot, index) => {
    const inset = input.kind === "OVAL" ? 120 + index * 22 : 80 + index * 16;
    const tableCount = getTableCountForLot(lot, input);
    const width = dimensions.width - inset * 2;
    const columns = getTableColumns(width, tableCount);
    const rows = Math.max(1, Math.ceil(tableCount / columns));
    const height = Math.max(170, rows * tableCellSize + 58);
    const geometry = {
      x: inset,
      y: currentY,
      width,
      height
    };

    currentY += height + sectionGap;
    return buildTableSection(lot, index, input, geometry);
  });
}

function getSeatMapElements(kind: SeatMapKind, width: number) {
  if (kind === "OVAL") {
    return [
      { id: "stage", kind: "STAGE" as const, label: "Palco", x: Math.round(width / 2 - 210), y: 38, width: 420, height: 90, color: "#27313d" }
    ];
  }

  return [
    { id: "stage", kind: "STAGE" as const, label: "Palco", x: Math.round(width / 2 - 280), y: 38, width: 560, height: 90, color: "#27313d" }
  ];
}

function mapSeatStatus(status: SeatStatus, isAccessible: boolean): SeatMapSeatStatus {
  if (status === SeatStatus.SOLD) return "SOLD";
  if (status === SeatStatus.RESERVED) return "RESERVED";
  if (status === SeatStatus.BLOCKED) return "UNAVAILABLE";
  if (isAccessible || status === SeatStatus.ACCESSIBLE) return "ACCESSIBLE";
  return "AVAILABLE";
}

function mapTableShape(shape?: string | null): SeatMapTableShape {
  if (shape === "SQUARE" || shape === "RECTANGLE") {
    return shape;
  }

  return "ROUND";
}

export async function releaseExpiredSeatReservations(tx: Tx | PrismaClient = prisma, now = new Date()) {
  const expiredReservations = await tx.seatReservation.findMany({
    where: {
      releasedAt: null,
      expiresAt: {
        lt: now
      },
      order: {
        status: OrderStatus.PENDING_PAYMENT
      }
    },
    select: {
      id: true,
      seatId: true
    },
    take: 500
  });

  if (expiredReservations.length === 0) {
    return 0;
  }

  const reservationIds = expiredReservations.map((reservation) => reservation.id);
  const seatIds = expiredReservations.map((reservation) => reservation.seatId);

  await tx.seatReservation.updateMany({
    where: {
      id: {
        in: reservationIds
      },
      releasedAt: null
    },
    data: {
      releasedAt: now
    }
  });

  await tx.seat.updateMany({
    where: {
      id: {
        in: seatIds
      },
      status: SeatStatus.RESERVED
    },
    data: {
      status: SeatStatus.AVAILABLE
    }
  });

  return expiredReservations.length;
}

export async function getPublicSeatMapForEvent(eventId: string): Promise<SeatMapLayout | null> {
  await releaseExpiredSeatReservations();

  const seatMap = await prisma.seatMap.findFirst({
    where: {
      eventId,
      isActive: true
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      sections: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        include: {
          seats: {
            orderBy: [{ tableLabel: "asc" }, { rowLabel: "asc" }, { seatNumber: "asc" }]
          },
          ticketLot: {
            select: {
              id: true,
              priceInCents: true,
              status: true
            }
          }
        }
      }
    }
  });

  if (!seatMap) {
    return null;
  }

  return {
    version: 1,
    kind: seatMap.kind,
    width: seatMap.width,
    height: seatMap.height,
    elements: getSeatMapElements(seatMap.kind, seatMap.width),
    sections: seatMap.sections.map((section) => {
      const tableGroups = new Map<string, typeof section.seats>();
      const looseSeats = section.seats.filter((seat) => !seat.tableId);

      section.seats.filter((seat) => seat.tableId).forEach((seat) => {
        const tableId = seat.tableId || "table";
        tableGroups.set(tableId, [...(tableGroups.get(tableId) ?? []), seat]);
      });

      return {
        id: section.id,
        ticketLotId: section.ticketLotId,
        name: section.name,
        color: section.color,
        x: section.x,
        y: section.y,
        width: section.width,
        height: section.height,
        priceInCents: section.priceInCents ?? section.ticketLot?.priceInCents ?? 0,
        description: section.description || undefined,
        priority: section.priority,
        seats: looseSeats.map((seat) => ({
          id: seat.id,
          sectionId: section.id,
          ticketLotId: seat.ticketLotId ?? section.ticketLotId,
          label: seat.label,
          number: seat.seatNumber,
          row: seat.rowLabel || undefined,
          x: seat.x,
          y: seat.y,
          radius: seat.radius,
          status: mapSeatStatus(seat.status, seat.isAccessible),
          priceInCents: seat.priceInCents ?? section.priceInCents ?? section.ticketLot?.priceInCents ?? 0,
          accessible: seat.isAccessible
        })),
        tables: Array.from(tableGroups.entries()).map(([tableId, seats]) => {
          const firstSeat = seats[0];
          const minX = Math.min(...seats.map((seat) => seat.x));
          const maxX = Math.max(...seats.map((seat) => seat.x));
          const minY = Math.min(...seats.map((seat) => seat.y));
          const maxY = Math.max(...seats.map((seat) => seat.y));
          const width = Math.max(42, maxX - minX - 24);
          const height = Math.max(42, maxY - minY - 24);

          return {
            id: tableId,
            sectionId: section.id,
            label: firstSeat?.tableLabel || tableId,
            x: Math.round((minX + maxX) / 2 - width / 2),
            y: Math.round((minY + maxY) / 2 - height / 2),
            width,
            height,
            shape: mapTableShape(firstSeat?.tableShape),
            seats: seats.map((seat) => ({
              id: seat.id,
              sectionId: section.id,
              ticketLotId: seat.ticketLotId ?? section.ticketLotId,
              tableId,
              label: seat.label,
              number: seat.seatNumber,
              x: seat.x,
              y: seat.y,
              radius: seat.radius,
              status: mapSeatStatus(seat.status, seat.isAccessible),
              priceInCents: seat.priceInCents ?? section.priceInCents ?? section.ticketLot?.priceInCents ?? 0,
              accessible: seat.isAccessible
            }))
          };
        })
      };
    })
  };
}

export async function reserveSeatsForOrderItem(input: {
  tx: Tx;
  eventId: string;
  orderId: string;
  orderItemId: string;
  lotId: string;
  seatIds: string[];
  expiresAt: Date;
}) {
  if (input.seatIds.length === 0) {
    return;
  }

  await releaseExpiredSeatReservations(input.tx);

  const seats = await input.tx.seat.findMany({
    where: {
      id: {
        in: input.seatIds
      },
      eventId: input.eventId,
      OR: [{ ticketLotId: input.lotId }, { section: { ticketLotId: input.lotId } }]
    },
    select: {
      id: true,
      status: true,
      priceInCents: true,
      section: {
        select: {
          priceInCents: true,
          ticketLot: {
            select: {
              priceInCents: true
            }
          }
        }
      }
    }
  });

  if (seats.length !== input.seatIds.length) {
    throw new Error("Um ou mais assentos selecionados nao pertencem ao lote escolhido.");
  }

  const unavailableSeat = seats.find((seat) => seat.status !== SeatStatus.AVAILABLE && seat.status !== SeatStatus.ACCESSIBLE);

  if (unavailableSeat) {
    throw new Error("Um ou mais assentos acabaram de ficar indisponiveis. Escolha novamente.");
  }

  const updated = await input.tx.seat.updateMany({
    where: {
      id: {
        in: input.seatIds
      },
      eventId: input.eventId,
      status: {
        in: [SeatStatus.AVAILABLE, SeatStatus.ACCESSIBLE]
      }
    },
    data: {
      status: SeatStatus.RESERVED
    }
  });

  if (updated.count !== input.seatIds.length) {
    throw new Error("Nao foi possivel reservar todos os assentos selecionados.");
  }

  await input.tx.seatReservation.createMany({
    data: input.seatIds.map((seatId) => ({
      seatId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      expiresAt: input.expiresAt
    }))
  });

  await input.tx.orderSeat.createMany({
    data: seats.map((seat) => ({
      seatId: seat.id,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      priceInCents: seat.priceInCents ?? seat.section.priceInCents ?? seat.section.ticketLot?.priceInCents ?? 0
    }))
  });
}

export async function releaseSeatReservationsForOrder(tx: Tx, orderId: string, now = new Date()) {
  const reservations = await tx.seatReservation.findMany({
    where: {
      orderId,
      releasedAt: null
    },
    select: {
      id: true,
      seatId: true
    }
  });

  if (reservations.length === 0) {
    return;
  }

  await tx.seatReservation.updateMany({
    where: {
      id: {
        in: reservations.map((reservation) => reservation.id)
      }
    },
    data: {
      releasedAt: now
    }
  });

  await tx.seat.updateMany({
    where: {
      id: {
        in: reservations.map((reservation) => reservation.seatId)
      },
      status: SeatStatus.RESERVED
    },
    data: {
      status: SeatStatus.AVAILABLE
    }
  });
}

export async function confirmSeatReservationsForOrder(tx: Tx, orderId: string) {
  const reservations = await tx.seatReservation.findMany({
    where: {
      orderId,
      releasedAt: null
    },
    select: {
      id: true,
      seatId: true
    }
  });

  if (reservations.length === 0) {
    return;
  }

  await tx.seat.updateMany({
    where: {
      id: {
        in: reservations.map((reservation) => reservation.seatId)
      },
      status: SeatStatus.RESERVED
    },
    data: {
      status: SeatStatus.SOLD
    }
  });
}

export async function releaseSoldSeatsForOrder(tx: Tx, orderId: string) {
  const orderSeats = await tx.orderSeat.findMany({
    where: {
      orderId
    },
    select: {
      seatId: true
    }
  });

  if (orderSeats.length === 0) {
    return;
  }

  await tx.seat.updateMany({
    where: {
      id: {
        in: orderSeats.map((orderSeat) => orderSeat.seatId)
      },
      status: SeatStatus.SOLD
    },
    data: {
      status: SeatStatus.AVAILABLE
    }
  });
}

export async function createNumberedSeatMapForEvent(eventId: string, organizationId: string, input: NumberedSeatMapInput) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId
    },
    select: {
      id: true,
      title: true,
      lots: {
        where: {
          status: {
            not: "CLOSED"
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          priceInCents: true,
          totalQuantity: true
        }
      }
    }
  });

  if (!event) {
    throw new Error("Evento nao encontrado para criar mapa numerado.");
  }

  if (event.lots.length === 0) {
    throw new Error("Crie pelo menos um lote antes de gerar o mapa numerado.");
  }

  const currentSections = await prisma.seatSection.findMany({
    where: {
      eventId,
      ticketLotId: {
        not: null
      },
      seatMap: {
        isActive: true
      }
    },
    include: {
      _count: {
        select: {
          seats: true
        }
      },
      ticketLot: {
        select: {
          id: true,
          name: true,
          priceInCents: true,
          totalQuantity: true
        }
      }
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });
  const lots = currentSections.length > 0
    ? currentSections
        .filter((section) => section.ticketLot)
        .map((section) => ({
          id: section.ticketLot!.id,
          name: section.name,
          priceInCents: section.priceInCents ?? section.ticketLot!.priceInCents,
          totalQuantity: section.ticketLot!.totalQuantity
        }))
    : event.lots;
  const dimensions = getDynamicMapDimensions(input.kind, lots, input);
  const sections = buildGeneratedSections(lots, input, dimensions);

  return prisma.$transaction(async (tx) => {
    await tx.seatMap.updateMany({
      where: {
        eventId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    const seatMap = await tx.seatMap.create({
      data: {
        eventId,
        name: `Mapa numerado - ${event.title}`,
        kind: input.kind,
        width: dimensions.width,
        height: dimensions.height,
        isActive: true,
        notes: `${getSeatMapKindLabel(input.kind)} gerado automaticamente a partir dos lotes do evento.`
      }
    });

    for (const [sectionIndex, section] of sections.entries()) {
      const lot = section.lot;
      const createdSection = await tx.seatSection.create({
        data: {
          seatMapId: seatMap.id,
          eventId,
          ticketLotId: lot.id,
          name: section.name,
          color: section.color,
          priceInCents: lot.priceInCents,
          description: section.description || lot.name,
          priority: section.priority ?? sectionIndex,
          x: section.x,
          y: section.y,
          width: section.width,
          height: section.height
        }
      });

      const seatsToCreate = section.seats.map((seat) => ({
          seatMapId: seatMap.id,
          sectionId: createdSection.id,
          eventId,
          ticketLotId: lot.id,
          publicCode: `${createdSection.id}-${seat.tableId || seat.row || "A"}-${seat.number}`,
          label: seat.label,
          rowLabel: seat.row || null,
          seatNumber: seat.number,
          tableId: seat.tableId || null,
          tableLabel: seat.tableLabel || null,
          tableShape: seat.tableShape || null,
          x: seat.x,
          y: seat.y,
          radius: seat.radius ?? 9,
          priceInCents: lot.priceInCents,
          status: seat.accessible ? "ACCESSIBLE" as const : "AVAILABLE" as const,
          isAccessible: Boolean(seat.accessible)
      }));

      await tx.seat.createMany({
        data: seatsToCreate
      });
    }

    return seatMap;
  }, {
    timeout: 120000
  });
}

export async function createRestaurantSeatMapForEvent(eventId: string, organizationId: string) {
  return createNumberedSeatMapForEvent(eventId, organizationId, {
    kind: "RESTAURANT",
    seatingMode: "WITH_TABLES",
    seatsPerTable: 4,
    tablesPerSection: null,
    tableShape: "ROUND"
  });
}
