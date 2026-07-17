import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type FinanceReport = Awaited<ReturnType<typeof getFinanceReport>>;
type EventRow = FinanceReport["byEvent"][number];

function pdfSafe(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\()]/g, "\\$&")
    .replace(/[^\x20-\x7E]/g, " ");
}

function fillRect(x: number, y: number, width: number, height: number, color: string) {
  return `${color}\n${x} ${y} ${width} ${height} re f`;
}

function strokeRect(x: number, y: number, width: number, height: number, color: string, lineWidth = 1) {
  return `${color}\n${lineWidth} w\n${x} ${y} ${width} ${height} re S`;
}

function text(x: number, y: number, value: unknown, options?: { size?: number; font?: "F1" | "F2"; color?: string; max?: number }) {
  const size = options?.size ?? 9;
  const font = options?.font ?? "F1";
  const color = options?.color ?? "0.067 0.094 0.153 rg";
  const max = options?.max ?? 100;

  return `${color}\nBT\n/${font} ${size} Tf\n${x} ${y} Td\n(${pdfSafe(value).slice(0, max)}) Tj\nET`;
}

function buildPdfFromPages(pages: string[]) {
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((content) => {
    const contentNumber = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    const pageNumber = objects.length + 1;
    pageObjectNumbers.push(pageNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`
    );
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function drawHeader(commands: string[], report: FinanceReport, page: number, totalPages: number) {
  commands.push(fillRect(0, 530, 842, 65, "0.000 0.290 0.235 rg"));
  commands.push(text(32, 566, "Vendas por evento", { size: 18, font: "F2", color: "1 1 1 rg" }));
  commands.push(text(32, 548, `Periodo: ${report.filters.startDate} a ${report.filters.endDate}`, {
    size: 9,
    color: "0.870 0.960 0.925 rg",
    max: 110
  }));
  commands.push(text(744, 566, `Pagina ${page}/${totalPages}`, { size: 8.5, font: "F2", color: "0.870 0.960 0.925 rg" }));
}

function drawMetric(commands: string[], x: number, y: number, label: string, value: string) {
  commands.push(fillRect(x, y - 44, 148, 56, "0.972 0.988 0.982 rg"));
  commands.push(strokeRect(x, y - 44, 148, 56, "0.788 0.871 0.843 RG", 0.6));
  commands.push(text(x + 12, y - 10, label, { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg", max: 32 }));
  commands.push(text(x + 12, y - 30, value, { size: 13, font: "F2", max: 28 }));
}

function drawSummary(commands: string[], report: FinanceReport) {
  const averageTicketInCents = report.totals.paidOrders > 0
    ? Math.round(report.totals.grossRevenueInCents / report.totals.paidOrders)
    : 0;

  drawMetric(commands, 32, 502, "Vendas confirmadas", report.totals.paidOrders.toLocaleString("pt-BR"));
  drawMetric(commands, 190, 502, "Faturamento bruto", formatCurrency(report.totals.grossRevenueInCents));
  drawMetric(commands, 348, 502, "Ticket medio", formatCurrency(averageTicketInCents));
  drawMetric(commands, 506, 502, "Ingressos vendidos", report.totals.ticketsIssued.toLocaleString("pt-BR"));
  drawMetric(commands, 664, 502, "Taxas recebidas", formatCurrency(report.totals.serviceFeeInCents));
}

function drawTableHeader(commands: string[], y: number) {
  commands.push(fillRect(28, y - 18, 786, 24, "0.944 0.969 0.961 rg"));
  commands.push(text(38, y - 9, "Evento", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(286, y - 9, "Pedidos", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(334, y - 9, "Ingressos", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(394, y - 9, "Venda ingressos", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(494, y - 9, "Taxas", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(570, y - 9, "Juros", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(638, y - 9, "Descontos", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(722, y - 9, "Total pago", { size: 7.1, font: "F2", color: "0.247 0.329 0.306 rg" }));
}

function drawEventRow(commands: string[], row: EventRow, y: number, index: number) {
  const rowColor = index % 2 === 0 ? "1 1 1 rg" : "0.988 0.995 0.992 rg";

  commands.push(fillRect(28, y - 28, 786, 30, rowColor));
  commands.push(strokeRect(28, y - 28, 786, 30, "0.858 0.902 0.890 RG", 0.35));
  commands.push(text(38, y - 9, row.title, { size: 7.2, font: "F2", max: 48 }));
  commands.push(text(286, y - 9, row.count, { size: 7, max: 8 }));
  commands.push(text(334, y - 9, row.tickets, { size: 7, max: 8 }));
  commands.push(text(394, y - 9, formatCurrency(row.ticketSubtotalInCents), { size: 7, font: "F2", max: 18 }));
  commands.push(text(494, y - 9, formatCurrency(row.serviceFeeInCents), { size: 7, font: "F2", max: 18 }));
  commands.push(text(570, y - 9, formatCurrency(row.cardInterestInCents), { size: 7, max: 18 }));
  commands.push(text(638, y - 9, formatCurrency(row.discountInCents), { size: 7, max: 18 }));
  commands.push(text(722, y - 9, formatCurrency(row.grossInCents), { size: 7, font: "F2", max: 18 }));
}

function buildFinanceEventsPdf(report: FinanceReport) {
  const rows = report.byEvent;
  const firstPageRows = 10;
  const nextPageRows = 12;
  const chunks: EventRow[][] = [];

  chunks.push(rows.slice(0, firstPageRows));
  for (let index = firstPageRows; index < rows.length; index += nextPageRows) {
    chunks.push(rows.slice(index, index + nextPageRows));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pages = chunks.map((chunk, pageIndex) => {
    const commands: string[] = [];
    drawHeader(commands, report, pageIndex + 1, chunks.length);

    if (pageIndex === 0) {
      drawSummary(commands, report);
    }

    const tableY = pageIndex === 0 ? 410 : 494;
    drawTableHeader(commands, tableY);
    chunk.forEach((row, index) => drawEventRow(commands, row, tableY - 36 - index * 32, index));

    if (rows.length === 0) {
      commands.push(text(32, tableY - 48, "Nenhuma venda paga encontrada nesse recorte.", { size: 10, font: "F2" }));
    }

    commands.push(
      text(32, 28, "Somente pedidos pagos com paidAt dentro do periodo filtrado. Total pago = ingressos + taxas + juros - descontos.", {
        size: 7.2,
        color: "0.360 0.431 0.541 rg",
        max: 150
      })
    );

    return commands.join("\n");
  });

  return buildPdfFromPages(pages);
}

export async function GET(request: Request) {
  const admin = await requirePermission("FINANCE");
  const url = new URL(request.url);
  const report = await getFinanceReport(
    {
      eventId: url.searchParams.get("eventId") || undefined,
      lotId: url.searchParams.get("lotId") || undefined,
      paymentMethod: url.searchParams.get("paymentMethod") || undefined,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined
    },
    admin.organizationId,
    getAdminAllowedEventIds(admin)
  );
  const pdf = buildFinanceEventsPdf(report);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vendas-por-evento-${new Date().toISOString().slice(0, 10)}.pdf"`
    }
  });
}
