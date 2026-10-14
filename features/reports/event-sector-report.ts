/** Categories and purchase packaging are not physical sectors. Unknown names are preserved. */
export function sectorFromLotName(name: string) {
  const sector = name.normalize("NFC").toLocaleUpperCase("pt-BR")
    .replace(/\b(?:MEIA(?:[\s-]+ENTRADA)?|INTEIRA|CORTESIA|ESTUDANTE|PCD|PROMOCIONAL|SOLID[ÁA]RI[OA]|DUPLO|INDIVIDUAL|EXCLUSIVO|COMPARTILHADO)\b/gu, " ")
    .replace(/\bPARA\s+\d+\s+PESSOAS\b/gu, " ")
    .replace(/\b\d+\s+LUGARES\b/gu, " ")
    .replace(/\s*[-–—|]+\s*/gu, " ")
    .replace(/\s+/gu, " ").trim();
  return sector || "SEM SETOR IDENTIFICADO";
}

export type SectorTotal = { name: string; quantity: number; revenueInCents?: number };
export function consolidateSectors(entries: SectorTotal[]) {
  const sectors = new Map<string, SectorTotal>();
  for (const entry of entries) {
    const name = entry.name.trim().replace(/\s+/gu, " ").toLocaleUpperCase("pt-BR");
    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const row = sectors.get(key) ?? { name, quantity: 0 };
    row.quantity += entry.quantity;
    sectors.set(key, row);
  }
  const rows = [...sectors.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  return { rows, total: rows.reduce((sum, row) => sum + row.quantity, 0) };
}

/** Distribute an item's historical ticket-only amount once across its issued admissions.
 * Cumulative rounding preserves every cent, including packages split across sectors. */
export function allocateSectorRevenue(amountInCents: number, quantities: number[]) {
  const total = quantities.reduce((sum, quantity) => sum + quantity, 0);
  let cumulative = 0;
  let allocated = 0;
  return quantities.map(quantity => {
    cumulative += quantity;
    const next = total ? Math.round(amountInCents * cumulative / total) : 0;
    const amount = next - allocated;
    allocated = next;
    return amount;
  });
}
