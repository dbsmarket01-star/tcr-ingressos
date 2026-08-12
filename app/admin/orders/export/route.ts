import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { listOrdersForCsvExport, type AdminOrderFilters } from "@/features/orders/order.admin.service";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type OrderExportRow = Awaited<ReturnType<typeof listOrdersForCsvExport>>[number];

type PaymentBucket = "card" | "pix" | "boleto" | "manual" | "simulated" | "other";

type EventReportRow = {
  eventId: string;
  eventTitle: string;
  venueName: string;
  city: string;
  state: string;
  orderCount: number;
  ticketCount: number;
  ticketValueInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
  paidTotalInCents: number;
};

const orderStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Vencido",
  REFUNDED: "Estornado"
};

const paymentBucketLabels: Record<PaymentBucket, string> = {
  card: "Cartao",
  pix: "Pix",
  boleto: "Boleto",
  manual: "Manual",
  simulated: "Simulado",
  other: "Outros"
};

const paymentBucketColors: Record<PaymentBucket, string> = {
  card: "0.000 0.420 0.310 rg",
  pix: "0.063 0.725 0.506 rg",
  boleto: "0.965 0.620 0.043 rg",
  manual: "0.259 0.361 0.918 rg",
  simulated: "0.475 0.549 0.639 rg",
  other: "0.647 0.263 0.847 rg"
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractPaymentPayload(rawPayload: unknown) {
  const root = asRecord(rawPayload);
  const nestedPayment = asRecord(root?.payment);
  return nestedPayment ?? root;
}

function paymentBucket(order: OrderExportRow): PaymentBucket {
  const payment = order.payment;

  if (!payment) {
    return "other";
  }

  const payload = extractPaymentPayload(payment.rawPayload);
  const billingType = typeof payload?.billingType === "string" ? payload.billingType : null;
  const manualLabel = typeof payload?.paymentMethodLabel === "string" ? payload.paymentMethodLabel : null;

  if (manualLabel) {
    return "manual";
  }

  if (payment.provider === "SIMULATED") {
    return "simulated";
  }

  if (billingType === "PIX" || payment.pixQrCodePayload) {
    return "pix";
  }

  if (billingType === "BOLETO") {
    return "boleto";
  }

  if (billingType === "CREDIT_CARD") {
    return "card";
  }

  return "other";
}

function getTicketCount(order: OrderExportRow) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function buildEventRows(orders: OrderExportRow[]) {
  const rowsByEvent = new Map<string, EventReportRow>();

  orders.forEach((order) => {
    const existing = rowsByEvent.get(order.eventId) ?? {
      eventId: order.eventId,
      eventTitle: order.event.title,
      venueName: order.event.venueName,
      city: order.event.city,
      state: order.event.state,
      orderCount: 0,
      ticketCount: 0,
      ticketValueInCents: 0,
      serviceFeeInCents: 0,
      cardInterestInCents: 0,
      paidTotalInCents: 0
    };

    existing.orderCount += 1;
    existing.ticketCount += getTicketCount(order);
    existing.ticketValueInCents += order.subtotalInCents;
    existing.serviceFeeInCents += order.serviceFeeInCents;
    existing.cardInterestInCents += order.cardInterestInCents;
    existing.paidTotalInCents += order.totalInCents;
    rowsByEvent.set(order.eventId, existing);
  });

  return Array.from(rowsByEvent.values()).sort((left, right) =>
    left.eventTitle.localeCompare(right.eventTitle, "pt-BR")
  );
}

function buildPaymentBreakdown(orders: OrderExportRow[]) {
  const initial = Object.keys(paymentBucketLabels).reduce(
    (acc, key) => ({
      ...acc,
      [key]: { count: 0, amountInCents: 0 }
    }),
    {} as Record<PaymentBucket, { count: number; amountInCents: number }>
  );

  orders.forEach((order) => {
    const bucket = paymentBucket(order);
    initial[bucket].count += 1;
    initial[bucket].amountInCents += order.totalInCents;
  });

  return initial;
}

function buildTotals(rows: EventReportRow[]) {
  return rows.reduce(
    (acc, row) => ({
      orderCount: acc.orderCount + row.orderCount,
      ticketCount: acc.ticketCount + row.ticketCount,
      ticketValueInCents: acc.ticketValueInCents + row.ticketValueInCents,
      serviceFeeInCents: acc.serviceFeeInCents + row.serviceFeeInCents,
      cardInterestInCents: acc.cardInterestInCents + row.cardInterestInCents,
      paidTotalInCents: acc.paidTotalInCents + row.paidTotalInCents
    }),
    {
      orderCount: 0,
      ticketCount: 0,
      ticketValueInCents: 0,
      serviceFeeInCents: 0,
      cardInterestInCents: 0,
      paidTotalInCents: 0
    }
  );
}

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
  const max = options?.max ?? 120;

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

function drawHeader(commands: string[], page: number, totalPages: number, filtersLabel: string) {
  commands.push(fillRect(0, 540, 842, 55, "0.000 0.290 0.235 rg"));
  commands.push(text(32, 570, "Relatorio de pedidos por evento", { size: 17, font: "F2", color: "1 1 1 rg" }));
  commands.push(text(32, 552, filtersLabel, { size: 8.5, color: "0.870 0.960 0.925 rg", max: 150 }));
  commands.push(text(754, 570, `Pagina ${page}/${totalPages}`, { size: 8.5, font: "F2", color: "0.870 0.960 0.925 rg" }));
}

function drawMetric(commands: string[], x: number, y: number, title: string, value: string, detail: string) {
  commands.push(fillRect(x, y, 150, 54, "0.973 0.984 0.980 rg"));
  commands.push(strokeRect(x, y, 150, 54, "0.858 0.902 0.890 RG", 0.45));
  commands.push(text(x + 12, y + 34, title, { size: 7.4, font: "F2", color: "0.396 0.455 0.545 rg", max: 30 }));
  commands.push(text(x + 12, y + 17, value, { size: 12, font: "F2", color: "0.067 0.094 0.153 rg", max: 28 }));
  commands.push(text(x + 12, y + 6, detail, { size: 6.8, font: "F2", color: "0.396 0.455 0.545 rg", max: 34 }));
}

function drawPieSlice(commands: string[], cx: number, cy: number, radius: number, startAngle: number, endAngle: number, color: string) {
  const steps = Math.max(6, Math.ceil((endAngle - startAngle) / 0.18));
  const points = [`${cx.toFixed(2)} ${cy.toFixed(2)} m`];

  for (let index = 0; index <= steps; index += 1) {
    const angle = startAngle + ((endAngle - startAngle) * index) / steps;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push(`${x.toFixed(2)} ${y.toFixed(2)} l`);
  }

  points.push("h f");
  commands.push(`${color}\n${points.join("\n")}`);
}

function drawPaymentPie(commands: string[], breakdown: Record<PaymentBucket, { count: number; amountInCents: number }>, x: number, y: number) {
  const entries = (Object.keys(paymentBucketLabels) as PaymentBucket[])
    .map((bucket) => ({ bucket, ...breakdown[bucket] }))
    .filter((entry) => entry.count > 0);
  const totalCount = entries.reduce((sum, entry) => sum + entry.count, 0);

  commands.push(text(x, y + 82, "Meios de pagamento", { size: 10.5, font: "F2" }));

  if (totalCount === 0) {
    commands.push(text(x, y + 56, "Sem pedidos no filtro.", { size: 8, color: "0.396 0.455 0.545 rg" }));
    return;
  }

  let currentAngle = -Math.PI / 2;
  entries.forEach((entry) => {
    const nextAngle = currentAngle + (entry.count / totalCount) * Math.PI * 2;
    drawPieSlice(commands, x + 44, y + 37, 34, currentAngle, nextAngle, paymentBucketColors[entry.bucket]);
    currentAngle = nextAngle;
  });

  entries.forEach((entry, index) => {
    const percent = Math.round((entry.count / totalCount) * 100);
    const legendY = y + 62 - index * 13;
    commands.push(fillRect(x + 96, legendY - 2, 8, 8, paymentBucketColors[entry.bucket]));
    commands.push(text(x + 110, legendY - 1, `${paymentBucketLabels[entry.bucket]}: ${percent}% (${entry.count})`, { size: 7.3, font: "F2", max: 35 }));
    commands.push(text(x + 110, legendY - 10, formatCurrency(entry.amountInCents), { size: 6.7, color: "0.396 0.455 0.545 rg", max: 28 }));
  });
}

function drawTableHeader(commands: string[], y: number) {
  commands.push(fillRect(28, y - 18, 786, 24, "0.944 0.969 0.961 rg"));
  commands.push(text(38, y - 9, "Evento", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(258, y - 9, "Cidade", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(356, y - 9, "Pedidos", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(420, y - 9, "Ingressos", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(498, y - 9, "Valor ingressos", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(606, y - 9, "Taxa bilheteria", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(716, y - 9, "Juros cartao", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
}

function drawEventRow(commands: string[], row: EventReportRow, y: number, index: number) {
  const rowColor = index % 2 === 0 ? "1 1 1 rg" : "0.988 0.995 0.992 rg";
  const eventLines = wrapText(row.eventTitle, 44).slice(0, 2);

  commands.push(fillRect(28, y - 36, 786, 38, rowColor));
  commands.push(strokeRect(28, y - 36, 786, 38, "0.858 0.902 0.890 RG", 0.35));
  eventLines.forEach((line, lineIndex) => {
    commands.push(text(38, y - 9 - lineIndex * 10, line, { size: lineIndex === 0 ? 7.4 : 6.7, font: lineIndex === 0 ? "F2" : "F1", max: 48 }));
  });
  commands.push(text(38, y - 29, row.venueName, { size: 6.5, color: "0.396 0.455 0.545 rg", max: 44 }));
  commands.push(text(258, y - 10, `${row.city}/${row.state}`, { size: 7, font: "F2", max: 24 }));
  commands.push(text(374, y - 10, row.orderCount, { size: 7.4, font: "F2", max: 8 }));
  commands.push(text(444, y - 10, row.ticketCount, { size: 7.4, font: "F2", max: 8 }));
  commands.push(text(498, y - 10, formatCurrency(row.ticketValueInCents), { size: 7.4, font: "F2", max: 20 }));
  commands.push(text(606, y - 10, formatCurrency(row.serviceFeeInCents), { size: 7.4, font: "F2", max: 20 }));
  commands.push(text(716, y - 10, formatCurrency(row.cardInterestInCents), { size: 7.4, font: "F2", max: 20 }));
}

function buildFiltersLabel(url: URL) {
  const period = [url.searchParams.get("startDate"), url.searchParams.get("endDate")].filter(Boolean).join(" a ") || "todos os periodos";
  const status = url.searchParams.get("status") ? orderStatusLabels[url.searchParams.get("status") || ""] || url.searchParams.get("status") : "todos os status";
  const city = url.searchParams.get("city") || "todas as cidades";
  const state = url.searchParams.get("state") || "todos os estados";

  return `Filtros: ${period} | ${status} | ${city} | ${state}`;
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

function buildOrdersPdf(orders: OrderExportRow[], filtersLabel: string) {
  const eventRows = buildEventRows(orders);
  const totals = buildTotals(eventRows);
  const paymentBreakdown = buildPaymentBreakdown(orders);
  const rowsPerPage = 10;
  const chunks: EventReportRow[][] = [];

  for (let index = 0; index < eventRows.length; index += rowsPerPage) {
    chunks.push(eventRows.slice(index, index + rowsPerPage));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pages = chunks.map((chunk, pageIndex) => {
    const commands: string[] = [];
    drawHeader(commands, pageIndex + 1, chunks.length, filtersLabel);

    if (pageIndex === 0) {
      drawMetric(commands, 32, 466, "Pedidos", String(totals.orderCount), "no filtro");
      drawMetric(commands, 194, 466, "Ingressos", String(totals.ticketCount), "por evento");
      drawMetric(commands, 356, 466, "Valor ingressos", formatCurrency(totals.ticketValueInCents), "sem taxas");
      drawMetric(commands, 518, 466, "Taxa bilheteria", formatCurrency(totals.serviceFeeInCents), "taxa paga");
      drawPaymentPie(commands, paymentBreakdown, 660, 432);
      drawTableHeader(commands, 386);

      chunk.forEach((row, index) => {
        drawEventRow(commands, row, 350 - index * 40, index);
      });

      return commands.join("\n");
    }

    drawTableHeader(commands, 500);
    chunk.forEach((row, index) => {
      drawEventRow(commands, row, 464 - index * 40, index);
    });

    return commands.join("\n");
  });

  return buildPdfFromPages(pages);
}

function getFiltersFromUrl(url: URL): AdminOrderFilters {
  return {
    eventId: url.searchParams.get("eventId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined,
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined,
    city: url.searchParams.get("city") || undefined,
    state: url.searchParams.get("state") || undefined
  };
}

export async function GET(request: Request) {
  const admin = await requirePermission("ORDERS");
  const url = new URL(request.url);
  const filters = getFiltersFromUrl(url);
  const orders = await listOrdersForCsvExport(filters, admin.organizationId, getAdminAllowedEventIds(admin));
  const pdf = buildOrdersPdf(orders, buildFiltersLabel(url));

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-pedidos-eventos-${new Date().toISOString().slice(0, 10)}.pdf"`
    }
  });
}
