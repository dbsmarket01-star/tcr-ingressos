import type { Prisma } from "@prisma/client";
import { orderTicketLots, orderTicketOptions } from "./lot-order";

/** Serialize administrative edits per event, including concurrent creation/reactivation. */
export async function lockEventLotOrder(tx: Prisma.TransactionClient, eventId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
  if (!rows.length) throw new Error("Evento não encontrado.");
}

export async function normalizeEventLotOrder(tx: Prisma.TransactionClient, eventId: string) {
  const lots = await tx.ticketLot.findMany({ where: { eventId }, include: { typeOptions: true } });
  const visible = lots.filter(lot => lot.status === "ACTIVE" || lot.status === "SOLD_OUT");
  const hidden = lots.filter(lot => lot.status !== "ACTIVE" && lot.status !== "SOLD_OUT");
  const ordered = [...orderTicketLots(visible), ...orderTicketLots(hidden)];
  for (const [sortOrder, lot] of ordered.entries()) {
    if (lot.sortOrder !== sortOrder) await tx.ticketLot.update({ where: { id: lot.id }, data: { sortOrder } });
    const options = orderTicketOptions(lot.typeOptions);
    for (const [index, option] of options.entries()) {
      if (option.sortOrder !== index) await tx.ticketLotOption.update({ where: { id: option.id }, data: { sortOrder: index } });
    }
  }
}
