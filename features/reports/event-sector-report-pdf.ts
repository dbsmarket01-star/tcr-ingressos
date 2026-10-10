import type { SectorTotal } from "./event-sector-report";

// Small, dependency-free PDF, following the existing report exporter. WinAnsi preserves Portuguese accents.
function escaped(value: string) {
  return value.replace(/—/g, "\x97").replace(/[^\x20-\xFF]/g, "?").replace(/[\\()]/g, "\\$&");
}
function text(value: string, x: number, y: number, size = 11, bold = false) {
  return `BT /${bold ? "B" : "R"} ${size} Tf ${x} ${y} Td (${escaped(value)}) Tj ET`;
}
export function buildEventSectorPdf(report: { event: { title: string }; rows: SectorTotal[]; total: number }, issuedAt = new Date()) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 0;
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(issuedAt);
  const wrap = (s: string, width = 70) => s.match(new RegExp(`.{1,${width}}(?:\\s|$)|.{1,${width}}`, "gu"))?.map(v => v.trim()) ?? [s];
  const newPage = () => {
    if (commands.length) pages.push(commands.join("\n"));
    commands = ["0.04 0.24 0.17 rg", text("Ingressos por setor", 42, 793, 20, true)];
    y = 766;
    for (const line of wrap(report.event.title, 62)) { commands.push(text(line, 42, y, 12, true)); y -= 17; }
    commands.push(text(`Emitido em ${date} (Brasília)`, 42, y - 7, 9));
    commands.push(text("Ingressos válidos de pedidos pagos, incluindo cortesias e utilizados.", 42, y - 26, 9));
    commands.push(text("Categorias agrupadas. Reservas e ingressos cancelados não entram.", 42, y - 40, 9));
    y -= 75;
  };
  newPage();
  for (const row of report.rows) {
    const lines = wrap(`${row.name} — TOTAL: ${row.quantity.toLocaleString("pt-BR")} INGRESSOS`, 65);
    if (y - lines.length * 17 < 65) newPage();
    for (const line of lines) { commands.push(text(line, 42, y, 11, true)); y -= 17; }
    y -= 12;
  }
  if (y < 95) newPage();
  commands.push(text(`TOTAL GERAL: ${report.total.toLocaleString("pt-BR")} INGRESSOS`, 42, y - 10, 14, true));
  pages.push(commands.join("\n"));
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    page += `\n${text(`Página ${index + 1} de ${pages.length}`, 42, 30, 9)}`;
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
