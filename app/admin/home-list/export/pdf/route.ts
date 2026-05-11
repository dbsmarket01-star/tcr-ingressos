import { HomeListStatus } from "@prisma/client";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { listHomeListEntriesForExport } from "@/features/hospitality/home-list.service";
import { formatDateInput, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusLabels: Record<HomeListStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELED: "Cancelado"
};

function parseStatus(value: string | null) {
  if (value === HomeListStatus.PENDING || value === HomeListStatus.CONFIRMED || value === HomeListStatus.CANCELED) {
    return value;
  }

  return null;
}

function pdfSafe(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\()]/g, "\\$&")
    .replace(/[^\x20-\x7E]/g, " ");
}

function chunkLines(lines: string[], size: number) {
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += size) {
    pages.push(lines.slice(index, index + size));
  }

  return pages.length > 0 ? pages : [[]];
}

function buildPdf(lines: string[]) {
  const pages = chunkLines(lines, 44);
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines) => {
    const content = [
      "BT",
      "/F1 10 Tf",
      "42 800 Td",
      "14 TL",
      ...pageLines.map((line) => `(${pdfSafe(line).slice(0, 108)}) Tj T*`),
      "ET"
    ].join("\n");
    const contentNumber = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    const pageNumber = objects.length + 1;
    pageObjectNumbers.push(pageNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`
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

export async function GET(request: Request) {
  const admin = await requirePermission("REPORTS");
  const { searchParams } = new URL(request.url);
  const entries = await listHomeListEntriesForExport(
    admin.organizationId,
    {
      eventId: searchParams.get("eventId"),
      hotelId: searchParams.get("hotelId"),
      status: parseStatus(searchParams.get("status")),
      search: searchParams.get("search")
    },
    getAdminAllowedEventIds(admin)
  );
  const lines = [
    "HOME LIST / HOTELARIA",
    `Gerado em ${formatDateTime(new Date())}`,
    "",
    ...entries.flatMap((entry, index) => [
      `${index + 1}. ${entry.event.title}`,
      `Hotel: ${entry.hotel.name} - ${entry.hotel.city}/${entry.hotel.state}`,
      `Pedido: ${entry.order.code} | Compra: ${formatDateTime(entry.purchaseDate)} | Status: ${statusLabels[entry.status]} | Quarto: ${entry.roomNumber ?? ""}`,
      `Hospede 1: ${entry.guest1Name} | CPF: ${entry.guest1Document} | Nasc.: ${formatDateInput(entry.guest1BirthDate)} | ${entry.guest1Email} | ${entry.guest1Phone}`,
      `Hospede 2: ${entry.guest2Name} | CPF: ${entry.guest2Document} | Nasc.: ${formatDateInput(entry.guest2BirthDate)}`,
      ""
    ])
  ];

  return new Response(buildPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="home-list.pdf"`
    }
  });
}
