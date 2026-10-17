import { sectorFromLotName } from "@/features/reports/event-sector-report";

type Ordered = { id: string; sortOrder: number; createdAt?: Date | string };
const compare = (a: Ordered, b: Ordered) => a.sortOrder - b.sortOrder ||
  new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime() || a.id.localeCompare(b.id);

/** Preserve the event's established sector sequence, keeping all its categories together. */
export function orderTicketLots<T extends Ordered & { name: string }>(lots: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const lot of [...lots].sort(compare)) {
    const key = sectorFromLotName(lot.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const group = groups.get(key) ?? [];
    group.push(lot);
    groups.set(key, group);
  }
  return [...groups.values()].flat();
}

/** Numeric ordering only for numbered tables/boxes; unrelated option labels retain their order. */
export function orderTicketOptions<T extends Ordered & { label: string }>(options: T[]): T[] {
  const ordered = [...options].sort(compare);
  const numbered = (label: string) => /^(?:MESA|CAMAROTE)\b.*?\d+\s*$/iu.test(label.trim());
  if (!ordered.every(option => numbered(option.label))) return ordered;
  return ordered.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }) || compare(a, b));
}
