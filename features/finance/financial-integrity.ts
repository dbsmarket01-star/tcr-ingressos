export function assertCents(value: number, label: string, signed = false): void {
  if (!Number.isSafeInteger(value) || (!signed && value < 0)) {
    throw new Error(`Valor financeiro inválido: ${label}. Use centavos inteiros seguros.`);
  }
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((sum, value) => {
    assertCents(value, "parcela", true);
    const next = sum + value;
    assertCents(next, "soma", true);
    return next;
  }, 0);
}

type Breakdown = {
  grossInCents: number;
  ticketNetInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
  count: number;
};
type Order = {
  id: string;
  totalInCents: number;
  ticketNetInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
};
type Report = {
  paidOrders: Order[];
  totals: { grossRevenueInCents: number; paidOrders: number } & Omit<Breakdown, "grossInCents" | "count">;
  byEvent: Breakdown[];
  byMethod: Breakdown[];
  bySource: Breakdown[];
};

/** Arithmetic integrity is not bank reconciliation or proof of source completeness. */
export function validateFinanceReport(report: Report) {
  const issues: string[] = [];
  try {
    const ids = new Set<string>();
    for (const order of report.paidOrders) {
      if (ids.has(order.id)) issues.push(`Pedido duplicado: ${order.id}`);
      ids.add(order.id);
      for (const key of ["totalInCents", "ticketNetInCents", "serviceFeeInCents", "cardInterestInCents"] as const) {
        assertCents(order[key], `${order.id}.${key}`);
      }
      if (order.totalInCents !== sumCents([order.ticketNetInCents, order.serviceFeeInCents, order.cardInterestInCents])) {
        issues.push(`Principal + taxa + juros diferem do total: ${order.id}`);
      }
    }
    const mappings = [
      ["totalInCents", "grossRevenueInCents", "grossInCents"],
      ["ticketNetInCents", "ticketNetInCents", "ticketNetInCents"],
      ["serviceFeeInCents", "serviceFeeInCents", "serviceFeeInCents"],
      ["cardInterestInCents", "cardInterestInCents", "cardInterestInCents"]
    ] as const;
    for (const [orderKey, totalKey, groupKey] of mappings) {
      const expected = sumCents(report.paidOrders.map(order => order[orderKey]));
      assertCents(report.totals[totalKey], totalKey);
      if (expected !== report.totals[totalKey]) issues.push(`Total divergente: ${totalKey}`);
      for (const group of ["byEvent", "byMethod", "bySource"] as const) {
        report[group].forEach(row => assertCents(row[groupKey], `${group}.${groupKey}`));
        if (sumCents(report[group].map(row => row[groupKey])) !== expected) {
          issues.push(`Agrupamento divergente: ${group}.${groupKey}`);
        }
      }
    }
    if (report.totals.paidOrders !== report.paidOrders.length) issues.push("Quantidade de pedidos divergente");
    for (const group of ["byEvent", "byMethod", "bySource"] as const) {
      report[group].forEach(row => assertCents(row.count, `${group}.count`));
      if (sumCents(report[group].map(row => row.count)) !== report.paidOrders.length) {
        issues.push(`Quantidade divergente: ${group}`);
      }
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Valores financeiros inválidos");
  }
  return { valid: issues.length === 0, issues };
}
