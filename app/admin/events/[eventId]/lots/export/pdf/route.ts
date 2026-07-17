import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getEventTicketSalesReport } from "@/features/reports/event-ticket-sales-report.service";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{
    eventId: string;
  }>;
};

type EventTicketSalesReport = NonNullable<Awaited<ReturnType<typeof getEventTicketSalesReport>>>;
type EventTicketSalesReportRow = EventTicketSalesReport["rows"][number];

const pageWidth = 842;
const pageHeight = 595;
const darkGreen = "0.000 0.290 0.125 rg";
const darkGreenStroke = "0.000 0.290 0.125 RG";
const midGreen = "0.000 0.420 0.190 rg";
const paleGreen = "0.936 0.980 0.956 rg";
const ink = "0.045 0.060 0.090 rg";
const muted = "0.260 0.330 0.420 rg";

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

function line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1) {
  return `${color}\n${lineWidth} w\n${x1} ${y1} m\n${x2} ${y2} l S`;
}

function text(
  x: number,
  y: number,
  value: unknown,
  options?: { size?: number; font?: "F1" | "F2"; color?: string; max?: number }
) {
  const size = options?.size ?? 8;
  const font = options?.font ?? "F1";
  const color = options?.color ?? ink;
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
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`
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

function formatIssuedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function drawBrand(commands: string[], brandName: string) {
  const [firstWord, ...rest] = brandName.split(/\s+/).filter(Boolean);
  const main = firstWord || "INGRESAAS";
  const suffix = rest.join(" ");

  commands.push(text(28, 530, main.toUpperCase(), { size: 21, font: "F2", color: midGreen, max: 20 }));
  commands.push(text(96, 530, suffix || "Ingressos", { size: 20, font: "F2", color: ink, max: 22 }));
  commands.push(text(47, 514, "AUTOMACAO OFICIAL DE EVENTOS", { size: 5.5, font: "F2", color: ink, max: 46 }));
}

function drawIssuedBox(commands: string[], issuedAt: Date, page: number, totalPages: number) {
  commands.push(fillRect(690, 504, 120, 78, "0.944 0.976 0.956 rg"));
  commands.push(strokeRect(690, 504, 120, 78, "0.860 0.920 0.890 RG", 0.4));
  commands.push(text(706, 558, "Emitido em:", { size: 8, color: muted, max: 30 }));
  commands.push(text(706, 544, formatIssuedAt(issuedAt), { size: 8.5, font: "F2", color: ink, max: 32 }));
  commands.push(line(706, 532, 802, 532, "0.680 0.800 0.740 RG", 0.45));
  commands.push(text(706, 516, "Pagina:", { size: 8, color: muted, max: 16 }));
  commands.push(text(706, 503, `${page} / ${totalPages}`, { size: 9, font: "F2", color: ink, max: 12 }));
}

function drawHeader(commands: string[], report: EventTicketSalesReport, issuedAt: Date, page: number, totalPages: number) {
  drawBrand(commands, report.organization.name);
  commands.push(text(360, 546, "Resumo de ingressos vendidos", { size: 17, font: "F2", color: ink, max: 58 }));
  commands.push(text(360, 522, report.event.title, { size: 10.5, font: "F2", color: midGreen, max: 62 }));
  drawIssuedBox(commands, issuedAt, page, totalPages);
  commands.push(line(28, 492, 810, 492, darkGreenStroke, 1.2));
}

function drawTableHeader(commands: string[], y: number) {
  commands.push(fillRect(28, y - 33, 784, 33, darkGreen));
  commands.push(text(40, y - 21, "NOME DE INGRESSO", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 26 }));
  commands.push(text(205, y - 21, "TIPO", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 10 }));
  commands.push(text(260, y - 21, "R$ UNIT.", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 12 }));
  commands.push(text(320, y - 21, "QTDE", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 8 }));
  commands.push(text(365, y - 21, "R$ INGRESSOS", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 18 }));
  commands.push(text(452, y - 21, "R$ TAXA", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 12 }));
  commands.push(text(515, y - 21, "R$ CUPONS", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 14 }));
  commands.push(text(588, y - 21, "ESTORNOS", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 14 }));
  commands.push(text(657, y - 21, "CHARGEBACK", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 16 }));
  commands.push(text(746, y - 21, "R$ TOTAL", { size: 7.2, font: "F2", color: "1 1 1 rg", max: 12 }));
}

function drawRow(commands: string[], row: EventTicketSalesReportRow, y: number, index: number) {
  commands.push(fillRect(28, y - 30, 784, 30, index % 2 === 0 ? "1 1 1 rg" : "0.968 0.978 0.974 rg"));
  commands.push(text(40, y - 18, row.ticketName, { size: 7.3, font: "F2", color: ink, max: 38 }));
  commands.push(text(205, y - 18, row.ticketType, { size: 7.1, color: ink, max: 10 }));
  commands.push(text(260, y - 18, formatCurrency(row.unitPriceInCents), { size: 7.1, color: ink, max: 13 }));
  commands.push(text(328, y - 18, row.quantity, { size: 7.1, color: ink, max: 7 }));
  commands.push(text(365, y - 18, formatCurrency(row.ticketRevenueInCents), { size: 7.1, color: ink, max: 16 }));
  commands.push(text(452, y - 18, formatCurrency(row.serviceFeeInCents), { size: 7.1, color: ink, max: 14 }));
  commands.push(text(515, y - 18, formatCurrency(row.couponDiscountInCents), { size: 7.1, color: ink, max: 14 }));
  commands.push(text(588, y - 18, formatCurrency(row.refundInCents), { size: 7.1, color: ink, max: 14 }));
  commands.push(text(657, y - 18, formatCurrency(row.chargebackInCents), { size: 7.1, color: ink, max: 14 }));
  commands.push(text(735, y - 18, formatCurrency(row.totalInCents), { size: 8.2, font: "F2", color: midGreen, max: 16 }));
  commands.push(line(28, y - 30, 812, y - 30, "0.880 0.900 0.890 RG", 0.35));
}

function drawTotalRow(commands: string[], report: EventTicketSalesReport, y: number) {
  commands.push(fillRect(28, y - 34, 784, 34, paleGreen));
  commands.push(text(40, y - 21, "TOTAIS", { size: 9, font: "F2", color: darkGreen, max: 18 }));
  commands.push(text(328, y - 21, report.totals.quantity, { size: 8.5, font: "F2", color: darkGreen, max: 8 }));
  commands.push(text(365, y - 21, formatCurrency(report.totals.ticketRevenueInCents), { size: 8.5, font: "F2", color: darkGreen, max: 16 }));
  commands.push(text(452, y - 21, formatCurrency(report.totals.serviceFeeInCents), { size: 8.5, font: "F2", color: darkGreen, max: 14 }));
  commands.push(text(515, y - 21, formatCurrency(report.totals.couponDiscountInCents), { size: 8.5, font: "F2", color: darkGreen, max: 14 }));
  commands.push(text(588, y - 21, formatCurrency(report.totals.refundInCents), { size: 8.5, font: "F2", color: darkGreen, max: 14 }));
  commands.push(text(657, y - 21, formatCurrency(report.totals.chargebackInCents), { size: 8.5, font: "F2", color: darkGreen, max: 14 }));
  commands.push(fillRect(720, y - 31, 80, 28, darkGreen));
  commands.push(text(732, y - 20, formatCurrency(report.totals.totalInCents), { size: 9, font: "F2", color: "1 1 1 rg", max: 16 }));
}

function drawFooter(commands: string[]) {
  commands.push(line(28, 67, 812, 67, "0.520 0.760 0.650 RG", 0.7));
  commands.push(strokeRect(40, 26, 17, 21, darkGreenStroke, 1.2));
  commands.push(text(45, 34, "$", { size: 11, font: "F2", color: midGreen, max: 2 }));
  commands.push(text(70, 43, "Este relatorio considera pedidos pagos e pedidos estornados/chargeback do evento.", { size: 8.5, color: muted, max: 100 }));
  commands.push(text(70, 29, "Total = ingressos + taxas - cupons - estornos - chargebacks.", { size: 8.5, color: muted, max: 86 }));
}

function buildEventTicketSalesPdf(report: EventTicketSalesReport) {
  const issuedAt = new Date();
  const rowsPerPage = 11;
  const chunks: EventTicketSalesReportRow[][] = [];

  for (let index = 0; index < report.rows.length; index += rowsPerPage) {
    chunks.push(report.rows.slice(index, index + rowsPerPage));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pages = chunks.map((chunk, pageIndex) => {
    const commands: string[] = [];
    const isLastPage = pageIndex === chunks.length - 1;
    drawHeader(commands, report, issuedAt, pageIndex + 1, chunks.length);
    drawTableHeader(commands, 470);

    if (report.rows.length === 0) {
      commands.push(fillRect(28, 382, 784, 54, "1 1 1 rg"));
      commands.push(text(44, 406, "Nenhum ingresso vendido encontrado para este evento.", { size: 11, font: "F2", color: ink, max: 70 }));
    } else {
      chunk.forEach((row, index) => drawRow(commands, row, 437 - index * 30, index));
    }

    if (isLastPage) {
      const totalY = 437 - chunk.length * 30;
      drawTotalRow(commands, report, Math.max(totalY, 105));
      drawFooter(commands);
    }

    return commands.join("\n");
  });

  return buildPdfFromPages(pages);
}

export async function GET(_request: Request, { params }: RouteProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const report = await getEventTicketSalesReport(admin.organizationId, eventId, getAdminAllowedEventIds(admin));

  if (!report) {
    notFound();
  }

  const pdf = buildEventTicketSalesPdf(report);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resumo-ingressos-${report.event.slug}.pdf"`
    }
  });
}
