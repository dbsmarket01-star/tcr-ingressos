import { prisma } from "@/lib/prisma";
import { createTicketLot } from "./lot.service";
import { lockEventLotOrder } from "./lot-order.service";
import { ticketLotSchema } from "./lot.schema";
import { numberedBoxPlanSchema, type NumberedBoxPlan } from "@/features/assistant/assistant-numbered-box";

/** A number denotes one sellable box; capacity only controls admissions/QR codes. */
export async function createAssistantNumberedBoxes(organizationId: string, input: NumberedBoxPlan) {
  const plan = numberedBoxPlanSchema.parse(input);
  return prisma.$transaction(async tx => {
    const event = await tx.event.findFirst({ where: { id: plan.eventId, organizationId }, select: { id: true, title: true, slug: true } });
    if (!event || event.title !== plan.eventTitle) throw new Error("O evento mudou ou não está disponível. Peça uma nova proposta.");
    await lockEventLotOrder(tx, event.id);
    const lots = await tx.ticketLot.findMany({ where: { eventId: event.id }, include: { typeOptions: true } });
    const numbers = [...plan.numbers].sort((a,b) => a-b);
    const name = `CAMAROTE PARA ${plan.admissionsPerUnit} PESSOAS`;
    for (const lot of lots) {
      if (lot.name.trim().toUpperCase() === name) throw new Error("Já existe um lote com essa capacidade. Não criei outro; use o cadastro de opções do lote existente.");
      const labels = [lot.name, ...lot.typeOptions.map(o => o.label)];
      if (labels.some(label => { const match = label.match(/^camarote\s*(?:n[ºo.]?\s*)?(\d+)(?:\s|$|[-–])/i); return match && numbers.includes(Number(match[1])); })) throw new Error("Um dos camarotes numerados já existe neste evento, inclusive entre pausados ou vendidos. Não criei duplicata.");
    }
    const data = ticketLotSchema.parse({ eventId: event.id, name, description: plan.description,
      priceInCents: plan.priceInCents, totalQuantity: numbers.length, admissionsPerUnit: plan.admissionsPerUnit,
      hasTypeOptions: true, typeOptionsText: numbers.map(n => `Camarote ${n}`).join("\n"),
      highlightColor: "#2563EB", serviceFeeBps: plan.serviceFeeBps,
      cardInterestBpsPerInstallment: plan.cardInterestBpsPerInstallment, cardInterestStartsAtInstallment: plan.cardInterestStartsAtInstallment,
      minPerOrder: 1, maxPerOrder: 1 });
    const created = await createTicketLot({ ...data, status: plan.status }, tx);
    const saved = await tx.ticketLot.findUniqueOrThrow({ where: { id: created.id }, include: { typeOptions: { orderBy: { sortOrder: "asc" } } } });
    if (saved.totalQuantity !== numbers.length || saved.admissionsPerUnit !== plan.admissionsPerUnit || saved.priceInCents !== plan.priceInCents || saved.status !== plan.status || saved.typeOptions.map(o => o.label).join("|") !== numbers.map(n => `Camarote ${n}`).join("|")) throw new Error("A gravação não corresponde à proposta. Operação revertida.");
    return { event, lot: saved };
  }, { timeout: 20000 });
}
