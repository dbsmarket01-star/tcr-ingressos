import { orderTicketLots } from "@/features/lots/lot-order";
import { sectorFromLotName } from "@/features/reports/event-sector-report";

type Lot = { id: string; name: string; priceInCents: number; sortOrder: number; status: string };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isTicketOrderRequest(message: string) {
  const text = normalize(message);
  return /\b(ordenar|ordene|organizar|organize|ordem|sequencia|fila)\b/.test(text)
    && /\b(ingressos?|lotes?|setores?|meia|inteira|november)\b/.test(text);
}

/** Keep the event's sector sequence; within each sector follow the requested category order. */
export function proposedTicketOrder<T extends Lot>(lots: T[]): T[] {
  const visible = orderTicketLots(lots.filter((lot) => lot.status === "ACTIVE" || lot.status === "SOLD_OUT"));
  const groups = new Map<string, T[]>();
  for (const lot of visible) {
    const sector = normalize(sectorFromLotName(lot.name));
    groups.set(sector, [...(groups.get(sector) || []), lot]);
  }
  const rank = (name: string) => {
    const value = normalize(name);
    if (/\bmeia(?:\s+entrada)?\b/.test(value)) return 0;
    if (/\bblack\s+november\b/.test(value)) return 1;
    if (/\binteira\b/.test(value)) return 2;
    return 3;
  };
  return [...groups.values()].flatMap((group) => [...group].sort((a, b) =>
    rank(a.name) - rank(b.name) || a.priceInCents - b.priceInCents || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
}
