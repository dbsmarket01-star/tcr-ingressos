import QRCode from "qrcode";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { formatDateTime } from "@/lib/format";

export type TicketPdfInput = {
  brandName: string;
  brandPrimaryColor?: string | null;
  eventTitle: string;
  eventDate: Date;
  venue: string;
  address: string;
  buyerName: string;
  orderCode: string;
  ticketCode: string;
  ticketName: string;
  issuedAt: Date;
  qrCodeToken: string;
  ticketUrl: string;
  scheduleLines: string[];
};

export function buildScheduleLines(scheduleDescription?: string | null, limit = 10) {
  return String(scheduleDescription ?? "")
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[\s•-]+/, "").trim())
    .filter(Boolean)
    .flatMap((line) => wrap(line, 85, 3))
    .slice(0, limit);
}

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
}

function pdfSafe(value: unknown) {
  return ascii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function text(x: number, y: number, value: unknown, size = 11, font = "F1", color = "0.08 0.12 0.18") {
  return `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfSafe(value)}) Tj ET`;
}

function fillRect(x: number, y: number, width: number, height: number, color = "0 0 0") {
  return `${color} rg ${x} ${y} ${width} ${height} re f`;
}

function strokeRect(x: number, y: number, width: number, height: number, color = "0.82 0.87 0.85") {
  return `${color} RG ${x} ${y} ${width} ${height} re S`;
}

function wrap(value: unknown, maxLength: number, maxLines = 3) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function truncate(value: unknown, maxLength: number) {
  const clean = ascii(value).trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function normalizeHexColor(value?: string | null) {
  const normalized = String(value ?? "").trim().replace(/^#/, "");

  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }

  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    return normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }

  return null;
}

function getFallbackBrandColor(brandName: string) {
  const lower = ascii(brandName).toLowerCase();

  if (lower.includes("tcr")) {
    return "0.040 0.380 0.280";
  }

  if (lower.includes("a2")) {
    return "0.000 0.373 0.561";
  }

  if (lower.includes("elo")) {
    return "0.180 0.520 0.470";
  }

  return "0.000 0.373 0.561";
}

function hexToRgbTriplet(value?: string | null, fallback = "0.000 0.373 0.561") {
  const hex = normalizeHexColor(value);

  if (!hex) {
    return fallback;
  }

  const parts = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((part) =>
    (Number.parseInt(part, 16) / 255).toFixed(3)
  );

  return parts.join(" ");
}

function mixPdfColor(color: string, amount: number, target: "white" | "black" = "white") {
  const targetValue = target === "white" ? 1 : 0;
  return color
    .split(/\s+/)
    .map((part) => {
      const value = Number.parseFloat(part);
      const mixed = value + (targetValue - value) * amount;
      return Math.max(0, Math.min(1, mixed)).toFixed(3);
    })
    .join(" ");
}

function brandLockup(value: string) {
  const clean = ascii(value).trim() || "Ingresaas";
  const lower = clean.toLowerCase();

  if (lower.includes("tcr")) {
    return {
      mark: "TCR",
      name: "Ingressos",
      subtitle: "Plataforma oficial de eventos"
    };
  }

  if (lower.includes("elo")) {
    return {
      mark: "Elo",
      name: "Conference",
      subtitle: "Ingressos oficiais"
    };
  }

  if (lower.includes("a2")) {
    return {
      mark: "A2",
      name: "Imergidos",
      subtitle: "Ingressos oficiais"
    };
  }

  const words = clean.split(/\s+/).filter(Boolean);

  return {
    mark: words[0]?.slice(0, 3).toUpperCase() || "ING",
    name: words.slice(1).join(" ") || clean,
    subtitle: "Ingresso digital com QR Code"
  };
}

function drawQrCode(value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, {
    errorCorrectionLevel: "M"
  });
  const modules = qr.modules;
  const moduleSize = size / modules.size;
  const quietZone = Math.max(12, moduleSize * 4);
  const commands = [fillRect(x - quietZone, y - quietZone, size + quietZone * 2, size + quietZone * 2, "1 1 1")];

  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.data[row * modules.size + col]) {
        commands.push(
          fillRect(
            Number((x + col * moduleSize).toFixed(3)),
            Number((y + (modules.size - row - 1) * moduleSize).toFixed(3)),
            Number((moduleSize + 0.04).toFixed(3)),
            Number((moduleSize + 0.04).toFixed(3))
          )
        );
      }
    }
  }

  return commands.join("\n");
}

function buildTicketPageStream(input: TicketPdfInput, hasBrandLogo: boolean) {
  const pageWidth = 595;
  const pageHeight = 842;
  const dark = "0.06 0.10 0.16";
  const muted = "0.34 0.41 0.50";
  const brand = hexToRgbTriplet(input.brandPrimaryColor, getFallbackBrandColor(input.brandName));
  const brandDark = mixPdfColor(brand, 0.18, "black");
  const brandSoft = mixPdfColor(brand, 0.90);
  const brandSoftBorder = mixPdfColor(brand, 0.70);
  const logo = brandLockup(input.brandName);
  const scheduleLines = input.scheduleLines.slice(0, 10);
  const scheduleTop = 300;
  const scheduleHeight = input.scheduleLines.length ? Math.min(158, 48 + scheduleLines.length * 11) : 0;
  const scheduleBottom = scheduleTop - scheduleHeight;
  const scheduleContent = input.scheduleLines.length
    ? [
        fillRect(58, scheduleBottom, 479, scheduleHeight, "0.985 0.992 0.996"),
        strokeRect(58, scheduleBottom, 479, scheduleHeight, brandSoftBorder),
        text(78, scheduleTop - 24, "OBSERVACOES", 8.5, "F2", brand),
        ...scheduleLines.map((line, index) =>
          text(
            78,
            scheduleTop - 46 - index * 11,
            line,
            line.startsWith("- ") ? 7.5 : 8.2,
            line.startsWith("- ") ? "F1" : "F2",
            line.startsWith("- ") ? muted : dark
          )
        )
      ]
    : [];
  const linkY = input.scheduleLines.length ? Math.max(118, scheduleBottom - 30) : 242;
  const urlY = input.scheduleLines.length ? Math.max(102, scheduleBottom - 46) : 226;

  return [
    fillRect(0, 0, pageWidth, pageHeight, "0.965 0.978 0.992"),
    fillRect(0, 746, pageWidth, 96, brand),
    fillRect(0, 728, pageWidth, 18, brandDark),
    ...(hasBrandLogo
      ? [fillRect(38, 766, 164, 57, "0.032 0.302 0.220"), "q 164 0 0 57 38 766 cm /Logo Do Q"]
      : [
          fillRect(38, 776, 72, 40, "1 1 1"),
          text(52, 788, logo.mark, logo.mark.length <= 3 ? 26 : 20, "F2", brand),
          text(124, 800, logo.name, 20, "F2", "1 1 1")
        ]),
    text(426, 795, "QR Code individual", 9, "F2", "1 1 1"),
    text(426, 779, "Valide este ingresso na entrada", 7.8, "F1", "0.90 0.96 1.00"),
    fillRect(34, 58, 527, 648, "1 1 1"),
    strokeRect(34, 58, 527, 648, "0.78 0.84 0.90"),
    text(58, 678, "EVENTO", 8.5, "F2", brand),
    ...wrap(input.eventTitle, 34, 2).map((line, index) => text(58, 654 - index * 19, line, index === 0 ? 20 : 15, "F2", dark)),
    fillRect(58, 528, 286, 86, brandSoft),
    strokeRect(58, 528, 286, 86, brandSoftBorder),
    text(76, 590, "DATA E HORARIO", 8, "F2", brand),
    text(76, 572, formatDateTime(input.eventDate), 11.5, "F2", dark),
    text(76, 550, "LOCAL", 8, "F2", brand),
    ...wrap(input.venue, 36, 2).map((line, index) => text(126, 550 - index * 11, line, 8.2, "F2", dark)),
    ...wrap(input.address, 60, 2).map((line, index) => text(76, 514 - index * 10, line, 7.6, "F1", muted)),
    fillRect(374, 504, 148, 148, "1 1 1"),
    strokeRect(374, 504, 148, 148, "0.78 0.84 0.90"),
    drawQrCode(input.qrCodeToken, 394, 524, 108),
    text(374, 486, truncate(input.ticketCode, 30), 8.5, "F2", dark),
    fillRect(58, 366, 479, 110, "0.996 0.998 1"),
    strokeRect(58, 366, 479, 110, "0.78 0.84 0.90"),
    text(78, 452, "INGRESSO", 8.2, "F2", brand),
    ...wrap(input.ticketName, 60, 2).map((line, index) => text(78, 434 - index * 13, line, index === 0 ? 12.5 : 10.5, "F2", dark)),
    ...scheduleContent,
    text(58, linkY, "CODIGO DO INGRESSO", 8.5, "F2", brand),
    text(58, urlY, input.ticketCode, 10, "F2", dark)
  ].join("\n");
}

async function loadTcrLogo() {
  try {
    const file = await readFile(join(process.cwd(), "public/brands/tcr-logomarca.png"));
    const { data, info } = await sharp(file).flatten({ background: "#084d38" }).raw().toBuffer({ resolveWithObject: true });
    return { data: deflateSync(data), width: info.width, height: info.height };
  } catch {
    return null;
  }
}

export async function buildTicketsPdf(inputs: TicketPdfInput[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const tcrLogo = inputs.some((input) => input.brandName.toLowerCase().includes("tcr")) ? await loadTcrLogo() : null;
  const pageStreams = inputs.map((input) => buildTicketPageStream(input, Boolean(tcrLogo && input.brandName.toLowerCase().includes("tcr"))));
  const pageObjectIds = pageStreams.map((_, index) => 5 + (tcrLogo ? 1 : 0) + index * 2);
  const objects: Buffer[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ].map((object) => Buffer.from(object, "utf8"));

  if (tcrLogo) {
    objects.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${tcrLogo.width} /Height ${tcrLogo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${tcrLogo.data.length} >>\nstream\n`, "utf8"),
      tcrLogo.data,
      Buffer.from("\nendstream", "utf8")
    ]));
  }

  pageStreams.forEach((stream, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    objects.push(
      Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${tcrLogo ? "/XObject << /Logo 5 0 R >>" : ""} >> /Contents ${contentObjectId} 0 R >>`, "utf8"),
      Buffer.from(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`, "utf8")
    );
  });

  const parts = [Buffer.from("%PDF-1.4\n", "utf8")];
  let position = parts[0].length;
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(position);
    const section = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "utf8"), object, Buffer.from("\nendobj\n", "utf8")]);
    parts.push(section);
    position += section.length;
  });

  const xrefOffset = position;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    trailer += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.concat([...parts, Buffer.from(trailer, "utf8")]);
}

export function buildTicketPdf(input: TicketPdfInput) {
  return buildTicketsPdf([input]);
}
