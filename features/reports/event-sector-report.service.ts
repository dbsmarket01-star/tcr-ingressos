import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateSectorRevenue, consolidateSectors, sectorFromLotName } from "./event-sector-report";

export async function getEventSectorReport(organizationId: string, eventId: string, allowedEventIds?: string[] | null, filter?: { orderWhere: Prisma.OrderWhereInput; lotId?: string; grouping?: "category" }) {
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
    by: ["lotId", "seatId", "lotOptionId", "orderItemId"],
    where: { eventId, ...(filter?.lotId ? { lotId: filter.lotId } : {}), status: { in: ["ACTIVE", "USED"] }, order: {
      ...(filter ? { AND: [filter.orderWhere] } : {}), status: "PAID", OR: [{ payment: null }, { payment: { status: { not: "REFUNDED" } } }]
    } },
    _count: { _all: true }
  });
  const items = await prisma.orderItem.findMany({
    where: { id: { in: [...new Set(counts.map(row => row.orderItemId))] }, order: { eventId, event: { organizationId } } },
    select: { id: true, totalInCents: true, order: { select: { totalInCents: true, refundedInCents: true } } }
  });
  const revenues = new Map<typeof counts[number], number>();
  for (const item of items) {
    const itemRows = counts.filter(row => row.orderItemId === item.id);
    const remaining = item.order.totalInCents > 0
      ? Math.max(0, 1 - Math.max(0, item.order.refundedInCents) / item.order.totalInCents) : 1;
    const allocations = allocateSectorRevenue(Math.round(item.totalInCents * remaining), itemRows.map(row => row._count._all));
    itemRows.forEach((row, index) => revenues.set(row, allocations[index]));
  }
  const revenueEntries: Array<{ name: string; amount: number }> = [];
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
  let solidarityTotal = 0;
  // This is a sales report, not an inventory report. Only issued admissions
  // from paid orders may create a row; unsold lots/options must stay out.
  const entries: Array<{ name: string; quantity: number }> = [];
  for (const row of counts) {
    const lot = lots.get(row.lotId);
    const option = lot?.typeOptions.find(option => option.id === row.lotOptionId);
    // A numbered private box is its own sector, even when its physical section is shared.
    const privateBox = lot && isPrivateBox(lot);
    const name = filter?.grouping === "category" && lot
      ? `${lot.name}${option ? ` - ${option.label}` : ""}`
      : privateBox && option ? boxName(option.label)
      : (row.seatId && seatNames.get(row.seatId))
        || (lot ? (privateBox && lot.typeOptions.length ? `${lotSector(lot)} - SEM NUMERAÇÃO IDENTIFICADA` : lotSector(lot)) : "SEM SETOR IDENTIFICADO");
    if (lot && /\bsolidari[oa]s?\b/i.test(`${lot.name} ${option?.label ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) solidarityTotal += row._count._all;
    entries.push({ name, quantity: row._count._all });
    revenueEntries.push({ name, amount: revenues.get(row) ?? 0 });
  }
  const result = consolidateSectors(entries);
  const revenueRows = consolidateSectors(revenueEntries.map(entry => ({ name: entry.name, quantity: entry.amount }))).rows;
  const rows = result.rows.map(row => ({ ...row, revenueInCents: revenueRows.find(value => value.name === row.name)?.quantity ?? 0 }));
  return { event, ...result, rows, solidarityTotal, revenueInCents: rows.reduce((sum, row) => sum + row.revenueInCents, 0) };
}
