import type { SectorTotal } from "./event-sector-report";

// Small, dependency-free PDF, following the existing report exporter. WinAnsi preserves Portuguese accents.
function escaped(value: string) {
  return value.replace(/—/g, "\x97").replace(/[^\x20-\xFF]/g, "?").replace(/[\\()]/g, "\\$&");
}
function text(value: string, x: number, y: number, size = 11, bold = false) {
  return `BT /${bold ? "B" : "R"} ${size} Tf ${x} ${y} Td (${escaped(value)}) Tj ET`;
}
export function buildEventSectorPdf(report: { event: { title: string }; rows: SectorTotal[]; total: number; revenueInCents?: number; groups?: Array<{ title: string; rows: SectorTotal[]; total: number; revenueInCents?: number; solidarityTotal?: number }>; filters?: string[]; grouping?: "category" }, issuedAt = new Date()) {
  const money = (value = 0) => `R$ ${(value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 0;
  const ink = "0.12 0.16 0.20";
  const muted = "0.40 0.45 0.49";
  const green = "0.04 0.29 0.20";
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(issuedAt);
  const wrap = (s: string, width = 75) => s.match(new RegExp(`.{1,${width}}(?:\\s|$)|.{1,${width}}`, "gu"))?.map(v => v.trim()) ?? [s];
  const label = (value: string, x: number, baseline: number, size = 10, bold = false, color = ink) => commands.push(`${color} rg`, text(value, x, baseline, size, bold));
  const rect = (x: number, bottom: number, width: number, height: number, color: string) => commands.push(`${color} rg ${x} ${bottom} ${width} ${height} re f`);
  const newPage = () => {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    rect(0, 829, 595, 13, green);
    label("TCR INGRESSOS", 36, 801, 11, true, green);
    label(`EMISSÃO ${date} | Brasília`, 330, 801, 8, false, muted);
    label(report.grouping === "category" ? "Ingressos por categoria" : "Ingressos por setor", 36, 769, 23, true);
    label(report.groups ? "Consolidado por evento e período" : "Consolidado do evento", 36, 750, 10, false, muted);
    y = 726;
    for (const filter of report.filters ?? []) {
      for (const line of wrap(filter, 104)) { label(line, 36, y, 8, false, muted); y -= 12; }
    }
    y -= 10;
  };
  const groupHeading = (title: string) => {
    const lines = wrap(title, 65);
    const height = 17 * lines.length + 18;
    rect(36, y - height, 523, height, green);
    lines.forEach((line, i) => label(line, 48, y - 22 - i * 17, 12, true, "1 1 1"));
    y -= height;
    rect(36, y - 22, 523, 22, "0.90 0.94 0.92");
    label(report.grouping === "category" ? "INGRESSO / CATEGORIA" : "SETOR", 48, y - 15, 8, true, muted);
    label("INGRESSOS", 359, y - 15, 8, true, muted);
    label("VALOR EM INGRESSOS", 443, y - 15, 8, true, muted);
    y -= 22;
  };
  newPage();
  const groups = report.groups ?? [{ title: report.event.title, rows: report.rows, total: report.total, revenueInCents: report.revenueInCents, solidarityTotal: 0 }];
  for (const group of groups) {
    if (y - wrap(group.title, 65).length * 17 < 160) newPage();
    groupHeading(group.title);
    group.rows.forEach((row, index) => {
      const lines = wrap(row.name, 46);
      const height = Math.max(26, lines.length * 13 + 12);
      if (y - height < 115) { newPage(); groupHeading(`${group.title} (continuação)`); }
      rect(36, y - height, 523, height, index % 2 ? "0.95 0.97 0.96" : "0.99 0.99 0.99");
      lines.forEach((line, i) => label(line, 48, y - 17 - i * 13, 9));
      const qty = row.quantity.toLocaleString("pt-BR");
      label(qty, 413 - qty.length * 6.1, y - 18, 11, true);
      const amount = money(row.revenueInCents);
      label(amount, 545 - amount.length * 5.5, y - 18, 10, true);
      y -= height;
    });
    if (y < (report.grouping === "category" ? 140 : 110)) { newPage(); groupHeading(`${group.title} (continuação)`); }
    rect(36, y - 29, 523, 29, "0.85 0.92 0.88");
    label(`TOTAL DO EVENTO: ${group.total.toLocaleString("pt-BR")} INGRESSOS`, 48, y - 19, 10, true, green);
    const subtotal = money(group.revenueInCents);
    label(subtotal, 545 - subtotal.length * 5.5, y - 19, 10, true, green);
    y -= 29;
    if (report.grouping === "category") {
      rect(36, y - 24, 523, 24, "0.94 0.97 0.95");
      label(`TOTAL DE INGRESSOS SOLIDÁRIOS: ${(group.solidarityTotal ?? 0).toLocaleString("pt-BR")}`, 48, y - 16, 9, true, green);
      y -= 24;
    }
    y -= 16;
  }
  if (!groups.length) { label("Nenhum ingresso vendido válido nos filtros selecionados.", 36, y, 10); y -= 28; }
  if (y < 125) newPage();
  rect(36, y - 38, 523, 38, "0.12 0.16 0.20");
  label(`TOTAL GERAL: ${report.total.toLocaleString("pt-BR")} INGRESSOS`, 48, y - 25, 11, true, "1 1 1");
  const grandTotal = money(report.revenueInCents);
  label(grandTotal, 545 - grandTotal.length * 6.7, y - 25, 12, true, "1 1 1");
  pages.push(commands.join("\n"));
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    page += `\n${muted} rg\n${text("Pedidos pagos | Ingressos válidos, incluindo cortesias e utilizados.", 36, 52, 8)}\n${text(report.grouping === "category" ? "Categorias separadas. Solidários já incluídos nos totais. Reservas e cancelados excluídos." : "Categorias agrupadas. Reservas e cancelados excluídos.", 36, 40, 8)}\n${text(`Página ${index + 1} de ${pages.length}`, 476, 30, 8)}`;
    const streamId = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(page, "latin1")} >>\nstream\n${page}\nendstream`);
    pageIds.push(objects.length + 1);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /R 3 0 R /B 4 0 R >> >> /Contents ${streamId} 0 R >>`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
