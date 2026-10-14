import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consolidateSectors, sectorFromLotName } from "./event-sector-report";

export async function getEventSectorReport(organizationId: string, eventId: string, allowedEventIds?: string[] | null, filter?: { orderWhere: Prisma.OrderWhereInput; lotId?: string }) {
  if (allowedEventIds && !allowedEventIds.includes(eventId)) return null;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    select: { id: true, title: true, slug: true, startsAt: true,
      lots: { select: { id: true, name: true, typeOptions: { select: { id: true, label: true } }, seatSections: { select: { name: true } } } }
    }
  });
  if (!event) return null;
  // Each issued QR code is one admission, including doubles, tables and complimentary tickets.
  const counts = await prisma.ticket.groupBy({
    by: ["lotId", "seatId", "lotOptionId"],
    where: { eventId, ...(filter?.lotId ? { lotId: filter.lotId } : {}), status: { in: ["ACTIVE", "USED"] }, order: {
      ...(filter ? { AND: [filter.orderWhere] } : {}), status: "PAID", OR: [{ payment: null }, { payment: { status: { not: "REFUNDED" } } }]
    } },
    _count: { _all: true }
  });
  const seatIds = counts.flatMap(row => row.seatId ? [row.seatId] : []);
  const seats = seatIds.length ? await prisma.seat.findMany({
    where: { id: { in: seatIds }, eventId }, select: { id: true, section: { select: { name: true } } }
  }) : [];
  const seatNames = new Map(seats.map(seat => [seat.id, seat.section.name]));
  const lots = new Map(event.lots.map(lot => [lot.id, lot]));
  const lotSector = (lot: typeof event.lots[number]) => lot.seatSections.length === 1
    ? lot.seatSections[0].name : sectorFromLotName(lot.name);
  const isPrivateBox = (lot: typeof event.lots[number]) => /\bcamarote\b/i.test(lot.name)
    && !/compartilhado/i.test(lot.name);
  const boxName = (label: string) => /\bcamarote\b/i.test(label) ? label : `CAMAROTE ${label}`;
  const entries = (filter ? [] : event.lots).flatMap(lot => {
    const names = isPrivateBox(lot) && lot.typeOptions.length
      ? lot.typeOptions.map(option => boxName(option.label))
      : lot.seatSections.length ? lot.seatSections.map(section => section.name) : [lotSector(lot)];
    return names.map(name => ({ name, quantity: 0 }));
  });
  for (const row of counts) {
    const lot = lots.get(row.lotId);
    const option = lot?.typeOptions.find(option => option.id === row.lotOptionId);
    // A numbered private box is its own sector, even when its physical section is shared.
    const privateBox = lot && isPrivateBox(lot);
    const name = privateBox && option ? boxName(option.label)
      : (row.seatId && seatNames.get(row.seatId))
        || (lot ? (privateBox && lot.typeOptions.length ? `${lotSector(lot)} - SEM NUMERAÇÃO IDENTIFICADA` : lotSector(lot)) : "SEM SETOR IDENTIFICADO");
    entries.push({ name, quantity: row._count._all });
  }
  return { event, ...consolidateSectors(entries) };
}
