import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { listOrdersForCsvExport } from "@/features/orders/order.admin.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type OrderExportRow = Awaited<ReturnType<typeof listOrdersForCsvExport>>[number];

const orderStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Vencido",
  REFUNDED: "Estornado"
};

const paymentStatusLabels: Record<string, string> = {
  CREATED: "Criado",
  PENDING: "Aguardando",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado"
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

function findCardLast4(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === "string") {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(-4) : null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nestedValue] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("last4") ||
      normalizedKey.includes("lastfour") ||
      normalizedKey.includes("creditcardnumber") ||
      normalizedKey.includes("cardnumber")
    ) {
      const last4 = findCardLast4(nestedValue, depth + 1);
      if (last4) {
        return last4;
      }
    }
  }

  for (const nestedValue of Object.values(record)) {
    const last4 = findCardLast4(nestedValue, depth + 1);
    if (last4) {
      return last4;
    }
  }

  return null;
}

function paymentMethodLabel(order: OrderExportRow) {
  const payment = order.payment;

  if (!payment) {
    return "Não iniciado";
  }

  const payload = extractPaymentPayload(payment.rawPayload);
  const billingType = typeof payload?.billingType === "string" ? payload.billingType : null;
  const manualLabel = typeof payload?.paymentMethodLabel === "string" ? payload.paymentMethodLabel : null;

  if (manualLabel) {
    return manualLabel;
  }

  if (payment.provider === "SIMULATED") {
    return "Simulado";
  }

  if (billingType === "PIX" || payment.pixQrCodePayload) {
    return "Pix";
  }

  if (billingType === "BOLETO") {
    return "Boleto";
  }

  if (billingType === "CREDIT_CARD") {
    const last4 = findCardLast4(payload);
    return last4 ? `Cartão **** ${last4}` : "Cartão";
  }

  return paymentStatusLabels[payment.status] ?? "Outros";
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

function drawHeader(commands: string[], page: number, totalPages: number, filtersLabel: string) {
  commands.push(fillRect(0, 540, 842, 55, "0.000 0.290 0.235 rg"));
  commands.push(text(32, 570, "Relatorio de pedidos", { size: 17, font: "F2", color: "1 1 1 rg" }));
  commands.push(text(32, 552, filtersLabel, { size: 8.5, color: "0.870 0.960 0.925 rg", max: 150 }));
  commands.push(text(754, 570, `Pagina ${page}/${totalPages}`, { size: 8.5, font: "F2", color: "0.870 0.960 0.925 rg" }));
}

function drawTableHeader(commands: string[], y: number) {
  commands.push(fillRect(28, y - 18, 786, 24, "0.944 0.969 0.961 rg"));
  commands.push(text(38, y - 9, "Pedido", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(122, y - 9, "Cliente", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(268, y - 9, "Evento", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(405, y - 9, "Cidade", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(488, y - 9, "Data", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(565, y - 9, "Valor", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(630, y - 9, "Status", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
  commands.push(text(716, y - 9, "Pagamento", { size: 7.4, font: "F2", color: "0.247 0.329 0.306 rg" }));
}

function drawOrderRow(commands: string[], order: OrderExportRow, y: number, index: number) {
  const rowColor = index % 2 === 0 ? "1 1 1 rg" : "0.988 0.995 0.992 rg";
  const city = `${order.event.city}/${order.event.state}`;
  const clientLines = [order.customer.name, order.customer.email, order.customer.phone || "Telefone não informado"];
  const eventLines = wrapText(order.event.title, 30).slice(0, 2);

  commands.push(fillRect(28, y - 38, 786, 40, rowColor));
  commands.push(strokeRect(28, y - 38, 786, 40, "0.858 0.902 0.890 RG", 0.35));
  commands.push(text(38, y - 10, order.code, { size: 7, font: "F2", max: 20 }));
  clientLines.forEach((line, lineIndex) => {
    commands.push(text(122, y - 8 - lineIndex * 10, line, { size: lineIndex === 0 ? 7.2 : 6.5, font: lineIndex === 0 ? "F2" : "F1", max: 34 }));
  });
  eventLines.forEach((line, lineIndex) => {
    commands.push(text(268, y - 8 - lineIndex * 10, line, { size: lineIndex === 0 ? 7.2 : 6.5, font: lineIndex === 0 ? "F2" : "F1", max: 32 }));
  });
  commands.push(text(405, y - 10, city, { size: 7, max: 22 }));
  commands.push(text(488, y - 10, formatDateTime(order.createdAt), { size: 7, max: 20 }));
  commands.push(text(565, y - 10, formatCurrency(order.totalInCents), { size: 7.4, font: "F2", max: 18 }));
  commands.push(text(630, y - 10, orderStatusLabels[order.status] ?? order.status, { size: 7.4, font: "F2", max: 20 }));
  commands.push(text(716, y - 10, paymentMethodLabel(order), { size: 7.1, max: 24 }));
}

function buildFiltersLabel(url: URL) {
  const period = [url.searchParams.get("startDate"), url.searchParams.get("endDate")].filter(Boolean).join(" a ") || "todos os periodos";
  const status = url.searchParams.get("status") ? orderStatusLabels[url.searchParams.get("status") || ""] || url.searchParams.get("status") : "todos os status";
  const city = url.searchParams.get("city") || "todas as cidades";
  const state = url.searchParams.get("state") || "todos os estados";

  return `Filtros: ${period} | ${status} | ${city} | ${state}`;
}

function buildOrdersPdf(orders: OrderExportRow[], filtersLabel: string) {
  const rowsPerPage = 11;
  const chunks: OrderExportRow[][] = [];

  for (let index = 0; index < orders.length; index += rowsPerPage) {
    chunks.push(orders.slice(index, index + rowsPerPage));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pages = chunks.map((chunk, pageIndex) => {
    const commands: string[] = [];
    drawHeader(commands, pageIndex + 1, chunks.length, filtersLabel);
    commands.push(text(32, 516, `Pedidos exportados: ${orders.length}`, { size: 9.2, font: "F2", color: "0.067 0.094 0.153 rg" }));
    drawTableHeader(commands, 488);

    chunk.forEach((order, index) => {
      drawOrderRow(commands, order, 452 - index * 42, index);
    });

    return commands.join("\n");
  });

  return buildPdfFromPages(pages);
}

export async function GET(request: Request) {
  const admin = await requirePermission("ORDERS");
  const url = new URL(request.url);
  const filters = {
    eventId: url.searchParams.get("eventId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined,
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined,
    city: url.searchParams.get("city") || undefined,
    state: url.searchParams.get("state") || undefined
  };
  const orders = await listOrdersForCsvExport(filters, admin.organizationId, getAdminAllowedEventIds(admin));
  const pdf = buildOrdersPdf(orders, buildFiltersLabel(url));

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.pdf"`
    }
  });
}
