import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { listOrdersForCsvExport } from "@/features/orders/order.admin.service";
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
  await requirePermission("ORDERS");
  const url = new URL(request.url);
  const orders = await listOrdersForCsvExport({
    eventId: url.searchParams.get("eventId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined,
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined
  });

  const headers = [
    "Pedido",
    "Status",
    "Cliente",
    "Email",
    "Telefone",
    "Documento",
    "Evento",
    "Itens",
    "Pagamento",
    "Subtotal",
    "Taxas",
    "Juros",
    "Desconto",
    "Total",
    "Cupom",
    "Origem",
    "Campanha",
    "Criado em",
    "Pago em"
  ];

  const rows = orders.map((order) => [
    order.code,
    order.status,
    order.customer.name,
    order.customer.email,
    order.customer.phone || "",
    order.customer.document || "",
    order.event.title,
    order.items.map((item) => `${item.quantity}x ${item.lot.name}`).join(" | "),
    order.payment?.status || "",
    formatMoney(order.subtotalInCents),
    formatMoney(order.serviceFeeInCents),
    formatMoney(order.cardInterestInCents),
    formatMoney(order.discountInCents),
    formatMoney(order.totalInCents),
    order.couponCode || "",
    [order.utmSource, order.utmMedium].filter(Boolean).join(" / ") || "Direto",
    order.utmCampaign || "",
    formatDate(order.createdAt),
    formatDate(order.paidAt)
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(";")).join("\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tcr-pedidos-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
