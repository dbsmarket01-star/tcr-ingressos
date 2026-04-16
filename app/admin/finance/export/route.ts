import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";

function csvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatMoney(valueInCents: number) {
  return (valueInCents / 100).toFixed(2).replace(".", ",");
}

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value) : "";
}

export async function GET(request: Request) {
  await requirePermission("FINANCE");
  const url = new URL(request.url);
  const report = await getFinanceReport({
    eventId: url.searchParams.get("eventId") || undefined,
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined
  });

  const rows: unknown[][] = [
    ["Resumo financeiro"],
    ["Periodo inicial", report.filters.startDate],
    ["Periodo final", report.filters.endDate],
    ["Bruto confirmado", formatMoney(report.totals.grossRevenueInCents)],
    ["Ingressos", formatMoney(report.totals.ticketSubtotalInCents)],
    ["Taxas e impostos", formatMoney(report.totals.serviceFeeInCents)],
    ["Juros de cartao", formatMoney(report.totals.cardInterestInCents)],
    ["Descontos", formatMoney(report.totals.discountInCents)],
    ["Liquido aproximado", formatMoney(report.totals.netRevenueInCents)],
    ["Taxas identificadas", formatMoney(report.totals.estimatedFeesInCents)],
    ["Split enviado", formatMoney(report.totals.splitTotalInCents)],
    ["TCR apos split", formatMoney(report.totals.tcrAfterSplitInCents)],
    ["Pedidos com split", report.totals.splitPaymentsCount],
    ["Cobertura split (%)", report.totals.splitCoverage],
    ["Pedidos pagos", report.totals.paidOrders],
    ["Pedidos pendentes", report.totals.pendingOrders],
    ["Cancelados/expirados", report.totals.canceledOrders],
    ["Ingressos emitidos", report.totals.ticketsIssued],
    ["Cobertura liquido real (%)", report.totals.netValueCoverage],
    [],
    ["Por forma de pagamento"],
    ["Forma", "Pedidos", "Bruto", "Taxas", "Juros", "Descontos", "Liquido"],
    ...report.byMethod.map((row) => [
      row.method,
      row.count,
      formatMoney(row.grossInCents),
      formatMoney(row.serviceFeeInCents),
      formatMoney(row.cardInterestInCents),
      formatMoney(row.discountInCents),
      formatMoney(row.netInCents)
    ]),
    [],
    ["Split Asaas por carteira"],
    ["Carteira", "Status Asaas", "Ocorrencias", "Total previsto"],
    ...report.bySplitWallet.map((row) => [
      row.walletLabel,
      row.status,
      row.count,
      formatMoney(row.totalInCents)
    ]),
    [],
    ["Por evento"],
    ["Evento", "Pedidos pagos", "Ingressos", "Taxas", "Juros", "Descontos", "Bruto", "Liquido"],
    ...report.byEvent.map((row) => [
      row.title,
      row.count,
      row.tickets,
      formatMoney(row.serviceFeeInCents),
      formatMoney(row.cardInterestInCents),
      formatMoney(row.discountInCents),
      formatMoney(row.grossInCents),
      formatMoney(row.netInCents)
    ]),
    [],
    ["Por origem"],
    ["Origem", "Pedidos", "Ingressos", "Taxas", "Juros", "Descontos", "Bruto", "Liquido"],
    ...report.bySource.map((row) => [
      row.source,
      row.count,
      formatMoney(row.ticketSubtotalInCents),
      formatMoney(row.serviceFeeInCents),
      formatMoney(row.cardInterestInCents),
      formatMoney(row.discountInCents),
      formatMoney(row.grossInCents),
      formatMoney(row.netInCents)
    ]),
    [],
    ["Pagamentos confirmados recentes"],
    ["Pedido", "Cliente", "Email", "Evento", "Pago em", "Origem", "Desconto", "Split", "Total"],
    ...report.recentPaidOrders.map((order) => [
      order.code,
      order.customer.name,
      order.customer.email,
      order.event.title,
      formatDate(order.paidAt),
      [order.utmSource, order.utmMedium].filter(Boolean).join(" / ") || "Direto",
      formatMoney(order.discountInCents),
      formatMoney(order.splitSummary.totalInCents),
      formatMoney(order.totalInCents)
    ])
  ];

  const csv = rows.map((row) => row.map(csvValue).join(";")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tcr-financeiro-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
