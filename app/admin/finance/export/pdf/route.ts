import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { getOrganizationContextById } from "@/features/organizations/organization.service";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type FinanceReport = Awaited<ReturnType<typeof getFinanceReport>>;
type EventRow = FinanceReport["byEvent"][number];

const pageWidth = 842;
const pageHeight = 595;
const darkGreen = "0.000 0.290 0.125 rg";
const darkGreenStroke = "0.000 0.290 0.125 RG";
const midGreen = "0.000 0.420 0.190 rg";
const paleGreen = "0.936 0.980 0.956 rg";
const lineGreen = "0.520 0.760 0.650 RG";
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
  const size = options?.size ?? 9;
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

function formatDateInputPt(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
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
  commands.push(fillRect(700, 546, 18, 20, midGreen));
  commands.push(text(704, 552, "cal", { size: 5.5, font: "F2", color: "1 1 1 rg", max: 8 }));
  commands.push(text(728, 558, "Emitido em:", { size: 8, color: muted, max: 30 }));
  commands.push(text(728, 544, formatIssuedAt(issuedAt), { size: 8.5, font: "F2", color: ink, max: 32 }));
  commands.push(line(728, 532, 802, 532, "0.680 0.800 0.740 RG", 0.45));
  commands.push(text(728, 516, "Pagina:", { size: 8, color: muted, max: 16 }));
  commands.push(text(728, 503, `${page} / ${totalPages}`, { size: 9, font: "F2", color: ink, max: 12 }));
}

function drawHeader(commands: string[], report: FinanceReport, brandName: string, issuedAt: Date, page: number, totalPages: number) {
  drawBrand(commands, brandName);
  commands.push(text(410, 546, "Relatorio de vendas por evento", { size: 18, font: "F2", color: ink, max: 60 }));
  commands.push(text(410, 520, "Periodo:", { size: 12, color: ink, max: 18 }));
  commands.push(text(468, 520, `${formatDateInputPt(report.filters.startDate)} a ${formatDateInputPt(report.filters.endDate)}`, {
    size: 12,
    font: "F2",
    color: midGreen,
    max: 40
  }));
  drawIssuedBox(commands, issuedAt, page, totalPages);
  commands.push(line(28, 492, 810, 492, darkGreenStroke, 1.2));
}

function drawTableHeader(commands: string[], y: number) {
  commands.push(fillRect(28, y - 40, 784, 40, darkGreen));
  commands.push(text(44, y - 25, "EVENTO", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 18 }));
  commands.push(text(205, y - 25, "PEDIDOS", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 16 }));
  commands.push(text(275, y - 25, "INGRESSOS", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 18 }));
  commands.push(text(350, y - 25, "VALOR DE INGRESSOS", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 28 }));
  commands.push(text(470, y - 25, "TAXAS", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 14 }));
  commands.push(text(555, y - 25, "JUROS", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 14 }));
  commands.push(text(623, y - 25, "DESCONTOS / CUPOM", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 28 }));
  commands.push(text(730, y - 25, "TOTAL PAGO", { size: 8.5, font: "F2", color: "1 1 1 rg", max: 18 }));
}

function drawEventRow(commands: string[], row: EventRow, y: number) {
  commands.push(fillRect(28, y - 62, 784, 62, "1 1 1 rg"));
  commands.push(line(28, y - 62, 812, y - 62, "0.880 0.900 0.890 RG", 0.45));
  commands.push(text(44, y - 34, row.title, { size: 10.5, font: "F2", color: ink, max: 36 }));
  commands.push(text(218, y - 34, row.count, { size: 10, font: "F2", color: ink, max: 8 }));
  commands.push(text(292, y - 34, row.tickets, { size: 10, font: "F2", color: ink, max: 8 }));
  commands.push(text(360, y - 34, formatCurrency(row.ticketSubtotalInCents), { size: 10, font: "F2", color: ink, max: 22 }));
  commands.push(text(462, y - 34, formatCurrency(row.serviceFeeInCents), { size: 10, font: "F2", color: ink, max: 20 }));
  commands.push(text(546, y - 34, formatCurrency(row.cardInterestInCents), { size: 10, font: "F2", color: ink, max: 20 }));
  commands.push(text(633, y - 34, formatCurrency(row.discountInCents), { size: 10, font: "F2", color: ink, max: 20 }));
  commands.push(fillRect(692, y - 54, 106, 42, paleGreen));
  commands.push(text(707, y - 35, formatCurrency(row.grossInCents), { size: 12.5, font: "F2", color: darkGreen, max: 24 }));
}

function drawTotalRow(commands: string[], report: FinanceReport, y: number) {
  commands.push(fillRect(28, y - 52, 784, 52, "0.952 0.988 0.966 rg"));
  commands.push(text(44, y - 32, "TOTAL GERAL", { size: 11, font: "F2", color: darkGreen, max: 22 }));
  commands.push(text(218, y - 32, report.totals.paidOrders, { size: 11, font: "F2", color: midGreen, max: 8 }));
  commands.push(text(292, y - 32, report.totals.ticketsIssued, { size: 11, font: "F2", color: midGreen, max: 8 }));
  commands.push(text(350, y - 32, formatCurrency(report.totals.ticketSubtotalInCents), { size: 11, font: "F2", color: midGreen, max: 24 }));
  commands.push(text(462, y - 32, formatCurrency(report.totals.serviceFeeInCents), { size: 11, font: "F2", color: midGreen, max: 20 }));
  commands.push(text(546, y - 32, formatCurrency(report.totals.cardInterestInCents), { size: 11, font: "F2", color: midGreen, max: 20 }));
  commands.push(text(633, y - 32, formatCurrency(report.totals.discountInCents), { size: 11, font: "F2", color: midGreen, max: 20 }));
  commands.push(fillRect(692, y - 45, 106, 38, darkGreen));
  commands.push(text(708, y - 30, formatCurrency(report.totals.grossRevenueInCents), { size: 12, font: "F2", color: "1 1 1 rg", max: 24 }));
}

function drawFooter(commands: string[]) {
  commands.push(line(28, 67, 812, 67, lineGreen, 0.7));
  commands.push(strokeRect(40, 26, 17, 21, darkGreenStroke, 1.2));
  commands.push(text(45, 34, "$", { size: 11, font: "F2", color: midGreen, max: 2 }));
  commands.push(text(70, 43, "Este relatorio apresenta as vendas confirmadas no periodo selecionado.", { size: 9, color: muted, max: 92 }));
  commands.push(text(70, 29, "Total pago = ingressos + taxas + juros - descontos/cupom.", { size: 9, color: muted, max: 86 }));
}

function buildFinanceEventsPdf(report: FinanceReport, brandName: string) {
  const rows = report.byEvent;
  const issuedAt = new Date();
  const rowsPerPage = 5;
  const chunks: EventRow[][] = [];

  for (let index = 0; index < rows.length; index += rowsPerPage) {
    chunks.push(rows.slice(index, index + rowsPerPage));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pages = chunks.map((chunk, pageIndex) => {
    const commands: string[] = [];
    const isLastPage = pageIndex === chunks.length - 1;
    drawHeader(commands, report, brandName, issuedAt, pageIndex + 1, chunks.length);
    drawTableHeader(commands, 470);

    if (rows.length === 0) {
      commands.push(fillRect(28, 370, 784, 58, "1 1 1 rg"));
      commands.push(text(44, 396, "Nenhuma venda paga encontrada nesse recorte.", { size: 11, font: "F2", color: ink, max: 70 }));
    } else {
      chunk.forEach((row, index) => drawEventRow(commands, row, 430 - index * 62));
    }

    if (isLastPage) {
      const totalY = 430 - chunk.length * 62;
      drawTotalRow(commands, report, Math.max(totalY, 112));
      drawFooter(commands);
    }

    return commands.join("\n");
  });

  return buildPdfFromPages(pages);
}

export async function GET(request: Request) {
  const admin = await requirePermission("FINANCE");
  const url = new URL(request.url);
  const [report, organizationContext] = await Promise.all([
    getFinanceReport(
      {
        eventId: url.searchParams.get("eventId") || undefined,
        lotId: url.searchParams.get("lotId") || undefined,
        paymentMethod: url.searchParams.get("paymentMethod") || undefined,
        startDate: url.searchParams.get("startDate") || undefined,
        endDate: url.searchParams.get("endDate") || undefined
      },
      admin.organizationId,
      getAdminAllowedEventIds(admin)
    ),
    getOrganizationContextById(admin.organizationId)
  ]);
  const pdf = buildFinanceEventsPdf(report, organizationContext.brandName);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vendas-por-evento-${new Date().toISOString().slice(0, 10)}.pdf"`
    }
  });
}
