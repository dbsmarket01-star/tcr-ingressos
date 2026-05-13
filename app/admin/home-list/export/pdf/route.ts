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

function drawBrandLockup(commands: string[], branding: { name: string; primaryColor: string | null }) {
  const brandMark = buildBrandMark(branding.name);

  commands.push(text(56, 790, brandMark, { size: brandMark.length > 2 ? 20 : 31, font: "F2", color: "1 1 1 rg", max: 18 }));
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

  commands.push(fillRect(0, 754, 595, 88, brandColor));
  commands.push(fillRect(0, 742, 595, 12, "0.905 0.955 0.980 rg"));
  drawBrandLockup(commands, branding);
  commands.push(strokeRect(116, 776, 1, 40, "0.720 0.880 0.955 RG", 0.9));
  commands.push(text(138, 808, "HOME LIST / HOTELARIA", { size: 15, font: "F2", color: "1 1 1 rg" }));
  commands.push(text(138, 789, hotelLabel, { size: 10.5, font: "F2", color: "0.920 0.970 0.992 rg", max: 70 }));
  commands.push(text(138, 772, eventLabel, { size: 9.2, color: "0.820 0.925 0.975 rg", max: 88 }));
  commands.push(text(468, 811, "Relatorio para hotel", { size: 8.2, color: "0.820 0.925 0.975 rg", max: 28 }));
  commands.push(strokeRect(42, 724, 511, 1, brandStroke, 0.6));
}

function infoLineHeight(value: unknown, maxChars: number) {
  return wrapText(value, maxChars).length * 10.5;
}

function drawInfoLine(
  commands: string[],
  x: number,
  y: number,
  label: string,
  value: unknown,
  options?: { labelWidth?: number; max?: number }
) {
  const labelWidth = options?.labelWidth ?? 68;
  const max = options?.max ?? 34;
  const lines = wrapText(value || "-", max);

  commands.push(text(x, y, `${label}:`, { size: 8.4, font: "F2", color: "0.067 0.094 0.153 rg", max: 22 }));
  lines.forEach((line, lineIndex) => {
    commands.push(text(x + labelWidth, y - lineIndex * 10.5, line, { size: 8.4, color: "0.235 0.294 0.376 rg", max }));
  });

  return y - lines.length * 10.5 - 2.5;
}

function estimateEntryHeight(entry: HomeListExportEntry) {
  const guest1Height =
    24 +
    infoLineHeight(entry.guest1Name, 32) +
    infoLineHeight(entry.guest1Document, 24) +
    infoLineHeight(formatDateInput(entry.guest1BirthDate), 24) +
    infoLineHeight(entry.guest1Email, 32) +
    infoLineHeight(entry.guest1Phone, 24);
  const guest2Height =
    24 +
    infoLineHeight(entry.guest2Name, 32) +
    infoLineHeight(entry.guest2Document, 24) +
    infoLineHeight(formatDateInput(entry.guest2BirthDate), 24);
  const notesLines = wrapText(entry.notes || "Sem observacoes.", 88);
  const notesHeight = 24 + notesLines.length * 10.5;

  return 70 + Math.max(guest1Height, guest2Height) + notesHeight;
}

function drawEntry(commands: string[], entry: HomeListExportEntry, index: number, y: number, brandStroke: string) {
  const roomNumber = entry.roomNumber || String(index + 1).padStart(2, "0");
  const notesLines = wrapText(entry.notes || "Sem observacoes.", 88);
  const height = estimateEntryHeight(entry);
  const cardBottom = y - height;
  const guest1X = 64;
  const guest2X = 314;
  const guestColumnWidth = 207;

  commands.push(fillRect(42, cardBottom, 511, height, "0.988 0.995 1.000 rg"));
  commands.push(strokeRect(42, cardBottom, 511, height, "0.820 0.882 0.918 RG", 0.8));
  commands.push(fillRect(42, y - 34, 511, 34, "0.945 0.975 0.990 rg"));
  commands.push(fillRect(64, y - 25, 72, 18, "0.000 0.247 0.365 rg"));
  commands.push(text(75, y - 19, `Quarto ${roomNumber}`, { size: 9.4, font: "F2", color: "1 1 1 rg", max: 18 }));
  commands.push(text(150, y - 18, `Hospedagem ${index + 1}`, { size: 9.2, font: "F2", color: "0.067 0.094 0.153 rg", max: 28 }));
  commands.push(text(400, y - 18, entry.lot.name, { size: 8.5, color: "0.392 0.455 0.545 rg", max: 36 }));
  commands.push(strokeRect(64, y - 46, 457, 1, brandStroke, 0.5));

  commands.push(fillRect(guest1X, y - 73, guestColumnWidth, 20, "0.890 0.960 0.988 rg"));
  commands.push(fillRect(guest2X, y - 73, guestColumnWidth, 20, "0.890 0.960 0.988 rg"));
  commands.push(text(guest1X + 10, y - 67, "Hospede 1", { size: 10, font: "F2", color: "0.000 0.247 0.365 rg" }));
  commands.push(text(guest2X + 10, y - 67, "Hospede 2", { size: 10, font: "F2", color: "0.000 0.247 0.365 rg" }));

  let guest1Y = y - 90;
  guest1Y = drawInfoLine(commands, guest1X, guest1Y, "Nome", entry.guest1Name, { max: 32 });
  guest1Y = drawInfoLine(commands, guest1X, guest1Y, "CPF", entry.guest1Document, { max: 24 });
  guest1Y = drawInfoLine(commands, guest1X, guest1Y, "Nascimento", formatDateInput(entry.guest1BirthDate), {
    labelWidth: 78,
    max: 24
  });
  guest1Y = drawInfoLine(commands, guest1X, guest1Y, "E-mail", entry.guest1Email, { max: 32 });
  guest1Y = drawInfoLine(commands, guest1X, guest1Y, "Telefone", entry.guest1Phone, { max: 24 });

  let guest2Y = y - 90;
  guest2Y = drawInfoLine(commands, guest2X, guest2Y, "Nome", entry.guest2Name, { max: 32 });
  guest2Y = drawInfoLine(commands, guest2X, guest2Y, "CPF", entry.guest2Document, { max: 24 });
  guest2Y = drawInfoLine(commands, guest2X, guest2Y, "Nascimento", formatDateInput(entry.guest2BirthDate), {
    labelWidth: 78,
    max: 24
  });

  const notesTop = Math.min(guest1Y, guest2Y) - 12;
  const notesBoxHeight = 22 + notesLines.length * 10.5;
  const notesBoxBottom = notesTop - notesBoxHeight + 8;
  commands.push(fillRect(64, notesBoxBottom, 457, notesBoxHeight, "1 1 1 rg"));
  commands.push(strokeRect(64, notesBoxBottom, 457, notesBoxHeight, "0.820 0.882 0.918 RG", 0.55));
  commands.push(text(78, notesTop - 6, "Observacoes:", { size: 8.8, font: "F2", color: "0.000 0.247 0.365 rg", max: 18 }));
  notesLines.forEach((line, lineIndex) => {
    commands.push(text(148, notesTop - 6 - lineIndex * 10.5, line, { size: 8.5, color: "0.235 0.294 0.376 rg", max: 80 }));
  });

  return cardBottom - 16;
}

function buildHomeListPdf(entries: HomeListExportEntry[], branding: { name: string; primaryColor: string | null }) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 700;
  const brandStroke = hexToPdfColor(branding.primaryColor, "stroke");

  const startPage = () => {
    commands = [];
    drawHeader(commands, entries, branding);
    y = 700;
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
