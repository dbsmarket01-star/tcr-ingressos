import { prisma } from "@/lib/prisma";
import { consolidateSectors, sectorFromLotName } from "./event-sector-report";

export async function getEventSectorReport(organizationId: string, eventId: string, allowedEventIds?: string[] | null) {
  if (allowedEventIds && !allowedEventIds.includes(eventId)) return null;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId },
    select: { id: true, title: true, slug: true, startsAt: true,
      lots: { select: { id: true, name: true, seatSections: { select: { name: true } } } }
    }
  });
  if (!event) return null;
  // Each issued QR code is one admission, including doubles, tables and complimentary tickets.
  const counts = await prisma.ticket.groupBy({
    by: ["lotId", "seatId"],
    where: { eventId, status: { in: ["ACTIVE", "USED"] }, order: {
      status: "PAID", OR: [{ payment: null }, { payment: { status: { not: "REFUNDED" } } }]
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
  const entries = event.lots.flatMap(lot => (lot.seatSections.length
    ? lot.seatSections.map(section => section.name) : [lotSector(lot)])
    .map(name => ({ name, quantity: 0 })));
  for (const row of counts) {
    const lot = lots.get(row.lotId);
    entries.push({ name: (row.seatId && seatNames.get(row.seatId)) || (lot ? lotSector(lot) : "SEM SETOR IDENTIFICADO"), quantity: row._count._all });
  }
  return { event, ...consolidateSectors(entries) };
}
