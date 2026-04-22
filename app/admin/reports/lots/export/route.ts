import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getLotSalesReport } from "@/features/reports/lot-sales-report.service";

function csvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatMoney(valueInCents: number) {
  return (valueInCents / 100).toFixed(2).replace(".", ",");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

export async function GET(request: Request) {
  const admin = await requirePermission("REPORTS");
  const url = new URL(request.url);
  const report = await getLotSalesReport(
    admin.organizationId!,
    url.searchParams.get("eventId") || undefined,
    getAdminAllowedEventIds(admin)
  );

  const headers = [
    "Evento",
    "Data do evento",
    "Status do evento",
    "Lote",
    "Status do lote",
    "Alerta",
    "Acao sugerida",
    "Preco",
    "Capacidade",
    "Vendidos",
    "Reservados",
    "Disponiveis",
    "Percentual vendido",
    "Check-ins",
    "Percentual check-in",
    "Ticket medio",
    "Taxas",
    "Receita bruta"
  ];

  const rows = report.rows.map((row) => [
    row.eventTitle,
    formatDate(row.eventStartsAt),
    row.eventStatus,
    row.name,
    row.status,
    row.alert.label,
    row.alert.action,
    formatMoney(row.priceInCents),
    row.totalQuantity,
    row.soldQuantity,
    row.reservedQuantity,
    row.availableQuantity,
    `${row.soldPercent}%`,
    row.usedTickets,
    `${row.checkInPercent}%`,
    formatMoney(row.averageGrossPerSoldTicketInCents),
    formatMoney(row.serviceFeeInCents),
    formatMoney(row.grossInCents)
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(";")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tcr-lotes-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
