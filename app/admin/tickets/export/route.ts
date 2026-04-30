import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { listTicketsForCsvExport } from "@/features/tickets/ticket.admin.service";
import { formatDateTime } from "@/lib/format";

function csvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatDate(value?: Date | null) {
  return value ? formatDateTime(value) : "";
}

export async function GET(request: Request) {
  await requirePermission("TICKETS");
  const url = new URL(request.url);
  const tickets = await listTicketsForCsvExport({
    eventId: url.searchParams.get("eventId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined
  });

  const headers = [
    "Ingresso",
    "Status",
    "Evento",
    "Lote",
    "Pedido",
    "Comprador",
    "Email",
    "Emitido em",
    "Usado em"
  ];

  const rows = tickets.map((ticket) => [
    ticket.code,
    ticket.status,
    ticket.event.title,
    ticket.lot.name,
    ticket.order.code,
    ticket.order.customer.name,
    ticket.order.customer.email,
    formatDate(ticket.issuedAt),
    formatDate(ticket.usedAt)
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(";")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tcr-ingressos-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
