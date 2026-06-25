import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type FinanceReport = Awaited<ReturnType<typeof getFinanceReport>>;
type PaidOrder = FinanceReport["paidOrders"][number];

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

function wrapText(value: unknown, maxChars: number) {
  const words = pdfSafe(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
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

function formatLotDisplayName(lotName: string, optionLabel?: string | null) {
  return optionLabel ? `${lotName} - ${optionLabel}` : lotName;
}

function formatOrderTickets(order: PaidOrder) {
  return Array.from(new Set(order.items.map((item) => formatLotDisplayName(item.lot.name, item.lotOption?.label)))).join(", ");
}

function drawHeader(commands: string[], page: number, totalPages: number, report: FinanceReport, eventName: string) {
  commands.push(fillRect(0, 540, 842, 55, "0.000 0.290 0.235 rg"));
  commands.push(text(32, 570, "Lista de compradores", { size: 17, font: "F2", color: "1 1 1 rg" }));
  commands.push(
    text(32, 552, `${eventName} | ${report.filters.startDate} a ${report.filters.endDate}`, {
      size: 8.5,
      color: "0.870 0.960 0.925 rg",
      max: 150
    })
  );
  commands.push(text(754, 570, `Pagina ${page}/${totalPages}`, { size: 8.5, font: "F2", color: "0.870 0.960 0.925 rg" }));
}

function drawTableHeader(commands: string[], y: number) {
  commands.push(fillRect(28, y - 18, 786, 24, "0.944 0.969 0.961 rg"));
  commands.push(text(38, y - 9, "Pago em", { size: 7.2, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(122, y - 9, "Nome completo", { size: 7.2, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(292, y - 9, "Evento", { size: 7.2, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(452, y - 9, "Ingresso", { size: 7.2, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(672, y - 9, "Valor", { size: 7.2, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(742, y - 9, "Pedido", { size: 7.2, font: "F2", color: "0.247 0.329 0.306 rg" }));
}

function drawOrderRow(commands: string[], order: PaidOrder, y: number, index: number) {
  const rowColor = index % 2 === 0 ? "1 1 1 rg" : "0.988 0.995 0.992 rg";
  const eventLines = wrapText(order.event.title, 34).slice(0, 2);
  const ticketLines = wrapText(formatOrderTickets(order), 46).slice(0, 2);

  commands.push(fillRect(28, y - 38, 786, 40, rowColor));
  commands.push(strokeRect(28, y - 38, 786, 40, "0.858 0.902 0.890 RG", 0.35));
  commands.push(text(38, y - 10, formatDateTime(order.paidAt ?? order.createdAt), { size: 6.7, max: 20 }));
  commands.push(text(122, y - 8, order.customer.name, { size: 7.3, font: "F2", max: 38 }));
  commands.push(text(122, y - 20, order.customer.email, { size: 6.4, max: 42 }));
  eventLines.forEach((line, lineIndex) => {
    commands.push(text(292, y - 8 - lineIndex * 10, line, { size: lineIndex === 0 ? 7.2 : 6.5, font: lineIndex === 0 ? "F2" : "F1", max: 36 }));
  });
  ticketLines.forEach((line, lineIndex) => {
    commands.push(text(452, y - 8 - lineIndex * 10, line, { size: lineIndex === 0 ? 7.1 : 6.5, font: lineIndex === 0 ? "F2" : "F1", max: 48 }));
  });
  commands.push(text(672, y - 10, formatCurrency(order.totalInCents), { size: 7.4, font: "F2", max: 18 }));
  commands.push(text(742, y - 10, order.code, { size: 7.2, font: "F2", max: 18 }));
}

function buildFinanceBuyersPdf(report: FinanceReport) {
  const rowsPerPage = 10;
  const orders = report.paidOrders;
  const chunks: PaidOrder[][] = [];
  const eventName = report.filters.eventId
    ? report.events.find((event) => event.id === report.filters.eventId)?.title ?? "Evento selecionado"
    : "Todos os eventos";

  for (let index = 0; index < orders.length; index += rowsPerPage) {
    chunks.push(orders.slice(index, index + rowsPerPage));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pages = chunks.map((chunk, pageIndex) => {
    const commands: string[] = [];
    drawHeader(commands, pageIndex + 1, chunks.length, report, eventName);
    commands.push(
      text(32, 518, `${orders.length} venda(s) paga(s) | ${report.totals.ticketsIssued} ingresso(s) emitido(s)`, {
        size: 9,
        font: "F2"
      })
    );

    if (pageIndex === 0) {
      drawTableHeader(commands, 486);
      chunk.forEach((order, index) => drawOrderRow(commands, order, 450 - index * 42, index));
    } else {
      drawTableHeader(commands, 486);
      chunk.forEach((order, index) => drawOrderRow(commands, order, 450 - index * 42, index));
    }

    if (orders.length === 0) {
      commands.push(text(32, 424, "Nenhuma venda paga encontrada nesse recorte.", { size: 10, font: "F2" }));
    }

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
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined
    },
    admin.organizationId,
    getAdminAllowedEventIds(admin)
  );
  const pdf = buildFinanceBuyersPdf(report);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="compradores-${new Date().toISOString().slice(0, 10)}.pdf"`
    }
  });
}
