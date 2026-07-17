import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { formatDateTime } from "@/lib/format";

function csvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatMoney(valueInCents: number) {
  return (valueInCents / 100).toFixed(2).replace(".", ",");
}

function formatDate(value?: Date | null) {
  return value ? formatDateTime(value) : "";
}

export async function GET(request: Request) {
  const admin = await requirePermission("FINANCE");
  const url = new URL(request.url);
  const report = await getFinanceReport(
    {
      eventId: url.searchParams.get("eventId") || undefined,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined
    },
    admin.organizationId,
    getAdminAllowedEventIds(admin)
  );

  const rows: unknown[][] = [
    ["Resumo financeiro"],
    ["Periodo inicial", report.filters.startDate],
    ["Periodo final", report.filters.endDate],
    ["Bruto confirmado", formatMoney(report.totals.grossRevenueInCents)],
    ["Venda de ingressos", formatMoney(report.totals.ticketSubtotalInCents)],
    ["Taxas recebidas", formatMoney(report.totals.serviceFeeInCents)],
    ["Juros de cartao", formatMoney(report.totals.cardInterestInCents)],
    ["Descontos", formatMoney(report.totals.discountInCents)],
    ["Pedidos pagos", report.totals.paidOrders],
    ["Pedidos pendentes", report.totals.pendingOrders],
    ["Cancelados/expirados", report.totals.canceledOrders],
    ["Ingressos emitidos", report.totals.ticketsIssued],
    [],
    ["Por forma de pagamento"],
    ["Forma", "Pedidos", "Bruto", "Taxas recebidas", "Juros", "Descontos"],
    ...report.byMethod.map((row) => [
      row.method,
      row.count,
      formatMoney(row.grossInCents),
      formatMoney(row.serviceFeeInCents),
      formatMoney(row.cardInterestInCents),
      formatMoney(row.discountInCents)
    ]),
    [],
    ["Por evento"],
    ["Evento", "Pedidos pagos", "Ingressos", "Venda de ingressos", "Taxas recebidas", "Juros", "Descontos", "Bruto"],
    ...report.byEvent.map((row) => [
      row.title,
      row.count,
      row.tickets,
      formatMoney(row.ticketSubtotalInCents),
      formatMoney(row.serviceFeeInCents),
      formatMoney(row.cardInterestInCents),
      formatMoney(row.discountInCents),
      formatMoney(row.grossInCents)
    ]),
    [],
    ["Por origem"],
    ["Origem", "Pedidos", "Venda de ingressos", "Taxas recebidas", "Juros", "Descontos", "Bruto"],
    ...report.bySource.map((row) => [
      row.source,
      row.count,
      formatMoney(row.ticketSubtotalInCents),
      formatMoney(row.serviceFeeInCents),
      formatMoney(row.cardInterestInCents),
      formatMoney(row.discountInCents),
      formatMoney(row.grossInCents)
    ]),
    [],
    ["Historico financeiro completo no periodo"],
    ["Pedido", "Cliente", "Email", "Evento", "Pago em", "Origem", "Desconto", "Total"],
    ...report.paidOrders.map((order) => [
      order.code,
      order.customer.name,
      order.customer.email,
      order.event.title,
      formatDate(order.paidAt),
      [order.utmSource, order.utmMedium].filter(Boolean).join(" / ") || "Direto",
      formatMoney(order.discountInCents),
      formatMoney(order.totalInCents)
    ])
  ];

  const csv = rows.map((row) => row.map(csvValue).join(";")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
