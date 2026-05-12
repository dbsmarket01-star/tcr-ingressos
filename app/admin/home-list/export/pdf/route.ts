import { HomeListStatus } from "@prisma/client";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { listHomeListEntriesForExport } from "@/features/hospitality/home-list.service";
import { getOrganizationBrandingById } from "@/features/organizations/organization.service";
import { formatDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

type HomeListExportEntry = Awaited<ReturnType<typeof listHomeListEntriesForExport>>[number];

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

function hexToPdfColor(hex?: string | null, mode: "fill" | "stroke" = "fill") {
  const fallback = mode === "fill" ? "0.000 0.310 0.475 rg" : "0.000 0.310 0.475 RG";
  const normalized = String(hex ?? "").trim().replace(/^#/, "");

  if (!/^[\da-f]{6}$/i.test(normalized)) {
    return fallback;
  }

  const channels = [0, 2, 4].map((start) => Number.parseInt(normalized.slice(start, start + 2), 16) / 255);
  return `${channels.map((channel) => channel.toFixed(3)).join(" ")} ${mode === "fill" ? "rg" : "RG"}`;
}

function fillRect(x: number, y: number, width: number, height: number, color: string) {
  return `${color}\n${x} ${y} ${width} ${height} re f`;
}

function strokeRect(x: number, y: number, width: number, height: number, color: string, lineWidth = 1) {
  return `${color}\n${lineWidth} w\n${x} ${y} ${width} ${height} re S`;
}

function text(x: number, y: number, value: unknown, options?: { size?: number; font?: "F1" | "F2"; color?: string; max?: number }) {
  const size = options?.size ?? 10;
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
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`
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

function buildBrandMark(name?: string | null) {
  const brandName = String(name ?? "Home List").trim();

  if (/a2/i.test(brandName)) {
    return "A2";
  }

  if (/tcr/i.test(brandName)) {
    return "TCR";
  }

  return brandName.split(/\s+/).slice(0, 2).join(" ").toUpperCase();
}

function getReportContext(entries: HomeListExportEntry[]) {
  const eventNames = Array.from(new Set(entries.map((entry) => entry.event.title)));
  const hotelNames = Array.from(
    new Set(entries.map((entry) => `${entry.hotel.name} - ${entry.hotel.city}/${entry.hotel.state}`))
  );

  return {
    eventLabel: eventNames.length === 1 ? eventNames[0] : "Multiplos eventos",
    hotelLabel: hotelNames.length === 1 ? hotelNames[0] : "Relatorio por hotel"
  };
}

function drawHeader(commands: string[], entries: HomeListExportEntry[], branding: { name: string; primaryColor: string | null }) {
  const brandColor = hexToPdfColor(branding.primaryColor, "fill");
  const brandStroke = hexToPdfColor(branding.primaryColor, "stroke");
  const { eventLabel, hotelLabel } = getReportContext(entries);

  commands.push(fillRect(0, 764, 595, 78, brandColor));
  commands.push(fillRect(0, 742, 595, 22, "0.925 0.961 0.984 rg"));
  commands.push(text(42, 793, buildBrandMark(branding.name), { size: 27, font: "F2", color: "1 1 1 rg", max: 16 }));
  commands.push(text(154, 808, "HOME LIST / HOTELARIA", { size: 15, font: "F2", color: "1 1 1 rg" }));
  commands.push(text(154, 789, hotelLabel, { size: 10, color: "0.925 0.961 0.984 rg" }));
  commands.push(text(154, 748, eventLabel, { size: 9, font: "F2", color: "0.000 0.247 0.365 rg" }));
  commands.push(strokeRect(42, 774, 74, 46, "1 1 1 RG", 1.2));
  commands.push(strokeRect(42, 736, 511, 1, brandStroke, 0.6));
}

function estimateEntryHeight(entry: HomeListExportEntry) {
  const notesLines = wrapText(entry.notes || "Sem observacoes.", 86);
  return 188 + Math.max(0, notesLines.length - 1) * 12;
}

function drawEntry(commands: string[], entry: HomeListExportEntry, index: number, y: number, brandStroke: string) {
  const roomNumber = entry.roomNumber || String(index + 1).padStart(2, "0");
  const notesLines = wrapText(entry.notes || "Sem observacoes.", 86);
  const height = estimateEntryHeight(entry);
  const cardBottom = y - height;
  const guest1X = 58;
  const guest2X = 315;

  commands.push(fillRect(42, cardBottom, 511, height, "0.975 0.988 0.996 rg"));
  commands.push(strokeRect(42, cardBottom, 511, height, "0.820 0.882 0.918 RG", 0.8));
  commands.push(fillRect(58, y - 33, 118, 24, "0.000 0.247 0.365 rg"));
  commands.push(text(72, y - 25, `Quarto ${roomNumber}`, { size: 13, font: "F2", color: "1 1 1 rg", max: 24 }));
  commands.push(text(190, y - 25, entry.hotel.name, { size: 12, font: "F2", color: "0.067 0.094 0.153 rg", max: 70 }));
  commands.push(text(190, y - 42, `${entry.hotel.city}/${entry.hotel.state}`, { size: 9, color: "0.392 0.455 0.545 rg", max: 62 }));
  commands.push(strokeRect(58, y - 56, 479, 1, brandStroke, 0.6));

  commands.push(fillRect(guest1X, y - 82, 216, 22, "0.902 0.965 0.988 rg"));
  commands.push(fillRect(guest2X, y - 82, 222, 22, "0.902 0.965 0.988 rg"));
  commands.push(text(guest1X + 10, y - 75, "Hospede 1", { size: 11, font: "F2", color: "0.000 0.247 0.365 rg" }));
  commands.push(text(guest2X + 10, y - 75, "Hospede 2", { size: 11, font: "F2", color: "0.000 0.247 0.365 rg" }));

  const guest1Lines = [
    `Nome: ${entry.guest1Name}`,
    `CPF: ${entry.guest1Document}`,
    `Nascimento: ${formatDateInput(entry.guest1BirthDate)}`,
    `E-mail: ${entry.guest1Email}`,
    `Telefone: ${entry.guest1Phone}`
  ];
  const guest2Lines = [
    `Nome: ${entry.guest2Name}`,
    `CPF: ${entry.guest2Document}`,
    `Nascimento: ${formatDateInput(entry.guest2BirthDate)}`
  ];

  guest1Lines.forEach((line, lineIndex) => {
    commands.push(text(guest1X, y - 102 - lineIndex * 13, line, { size: 9.5, max: 52 }));
  });
  guest2Lines.forEach((line, lineIndex) => {
    commands.push(text(guest2X, y - 102 - lineIndex * 13, line, { size: 9.5, max: 48 }));
  });

  const notesTop = y - 170;
  commands.push(text(58, notesTop, "Observacoes para o hotel", { size: 10, font: "F2", color: "0.000 0.247 0.365 rg" }));
  notesLines.forEach((line, lineIndex) => {
    commands.push(text(58, notesTop - 15 - lineIndex * 12, line, { size: 9.2, color: "0.235 0.294 0.376 rg", max: 100 }));
  });

  return cardBottom - 16;
}

function buildHomeListPdf(entries: HomeListExportEntry[], branding: { name: string; primaryColor: string | null }) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 716;
  const brandStroke = hexToPdfColor(branding.primaryColor, "stroke");

  const startPage = () => {
    commands = [];
    drawHeader(commands, entries, branding);
    y = 716;
  };
  const finishPage = () => {
    pages.push(commands.join("\n"));
  };

  startPage();

  if (entries.length === 0) {
    commands.push(text(42, 690, "Nenhuma hospedagem encontrada para os filtros selecionados.", { size: 12, font: "F2" }));
  }

  entries.forEach((entry, index) => {
    const height = estimateEntryHeight(entry);

    if (y - height < 48) {
      finishPage();
      startPage();
    }

    y = drawEntry(commands, entry, index, y, brandStroke);
  });

  finishPage();
  return buildPdfFromPages(pages);
}

export async function GET(request: Request) {
  const admin = await requirePermission("REPORTS");
  const { searchParams } = new URL(request.url);
  const [entries, organization] = await Promise.all([
    listHomeListEntriesForExport(
      admin.organizationId,
      {
        eventId: searchParams.get("eventId"),
        hotelId: searchParams.get("hotelId"),
        status: parseStatus(searchParams.get("status")),
        search: searchParams.get("search")
      },
      getAdminAllowedEventIds(admin)
    ),
    getOrganizationBrandingById(admin.organizationId)
  ]);

  return new Response(
    buildHomeListPdf(entries, {
      name: organization?.name ?? "Home List",
      primaryColor: organization?.primaryColor ?? "#005f8f"
    }),
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="home-list.pdf"`
      }
    }
  );
}
