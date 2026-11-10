import { createHash } from "node:crypto";
import { z } from "zod";
import { fetchPublicEventHtml, parsePublicEventUrl } from "./public-event-source";

export const sourceTicketSchema = z.object({
  name: z.string().min(2).max(160), priceInCents: z.number().int().min(1000),
  description: z.string().max(4000), color: z.string(), infoId: z.string(),
  needsOptions: z.boolean(), admissionsPerUnit: z.number().int().min(1).max(100),
  priceIsMinimum: z.boolean()
});
export const importSourceSchema = z.object({
  url: z.string().url(), fingerprint: z.string(), title: z.string(), dateText: z.string(),
  venueName: z.string(), venueAddress: z.string(), city: z.string(), state: z.string(),
  description: z.string(), bannerUrl: z.string(), mapUrl: z.string(),
  tickets: z.array(sourceTicketSchema).min(1).max(60), warnings: z.array(z.string())
});
export type ImportSource = z.infer<typeof importSourceSchema>;
export const importPlanSchema = z.object({
  source: importSourceSchema,
  startsAt: z.string().datetime({ offset: true }), city: z.string().min(2).max(120), state: z.string().regex(/^[A-Z]{2}$/),
  venueName: z.string().min(2).max(200), venueAddress: z.string().min(5).max(500),
  publish: z.boolean(), noMapConfirmed: z.boolean(), reviewed: z.literal(true),
  // These are explicit operator choices, never inferred from an unrelated event.
  serviceFeeBps: z.number().int().min(0).max(3000),
  cardInterestBpsPerInstallment: z.number().int().min(0).max(1000),
  cardInterestStartsAtInstallment: z.number().int().min(1).max(12),
  minPerOrder: z.number().int().min(1).max(100), maxPerOrder: z.number().int().min(1).max(100),
  tickets: z.array(z.object({
    quantity: z.number().int().min(1).max(1000000),
    admissionsPerUnit: z.number().int().min(1).max(100),
    options: z.array(z.string().trim().min(1).max(100)).max(200),
    description: z.string().max(4000), descriptionReviewed: z.literal(true),
    priceInCents: z.number().int().min(1000),
  })).min(1).max(60)
}).superRefine((plan, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (!plan.source.title || !plan.source.description || !plan.source.bannerUrl) fail("A fonte precisa informar título, descrição e banner.");
  if (!plan.source.mapUrl && !plan.noMapConfirmed) fail("Confirme explicitamente que este evento não usa mapa.");
  if (plan.minPerOrder > plan.maxPerOrder) fail("O mínimo por pedido não pode superar o máximo.");
  const dateText = normalizeImportText(plan.source.dateText);
  const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const namedDate = dateText.match(/\b(\d{1,2}) de ([a-z]+)\b/);
  const clock = dateText.match(/\b(\d{1,2})h(?:\s*(\d{2}))?\b/);
  const date = new Date(plan.startsAt);
  if (!Number.isNaN(date.getTime())) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map(p => [p.type, p.value]));
    if (namedDate && months.includes(namedDate[2]) && (Number(parts.day) !== Number(namedDate[1]) || Number(parts.month) !== months.indexOf(namedDate[2]) + 1)) fail("Dia e mês devem corresponder à referência.");
    if (clock && (Number(parts.hour) !== Number(clock[1]) || Number(parts.minute) !== Number(clock[2] || 0))) fail("O horário deve corresponder à referência em Brasília.");
    const year = dateText.match(/\b(20\d{2})\b/);
    if (year && parts.year !== year[1]) fail("O ano deve corresponder à referência.");
  }
  if (plan.tickets.length !== plan.source.tickets.length) fail("Confira todos os ingressos da fonte.");
  plan.source.tickets.forEach((ticket, index) => {
    const settings = plan.tickets[index];
    if (!settings) return;
    if (!ticket.priceIsMinimum && settings.priceInCents !== ticket.priceInCents) fail(`Preço diferente da fonte: ${ticket.name}.`);
    if (ticket.needsOptions && !settings.options.length) fail(`Informe a numeração disponível de ${ticket.name}.`);
    if (new Set(settings.options.map(normalizeImportText)).size !== settings.options.length) fail(`Numeração repetida em ${ticket.name}.`);
    if (settings.options.length && settings.quantity !== settings.options.length) fail(`Estoque deve corresponder às unidades numeradas de ${ticket.name}.`);
  });
});
export type ImportPlan = z.infer<typeof importPlanSchema>;
export type ImportProposal = { kind: "EVENT_IMPORT_SETUP"; id: string; eventId: ""; eventTitle: string; source: ImportSource }
  | { kind: "EVENT_IMPORT"; id: string; eventId: ""; eventTitle: string; plan: ImportPlan };

export function normalizeImportText(text: string) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function importRequested(text: string) {
  return /\b(suba|subir|cadastre|cadastrar|importe|importar|publique|publicar)\b/.test(normalizeImportText(text));
}
export function sourceUrl(text: string) {
  const raw = text.match(/https:\/\/[^\s<>]+/i)?.[0]?.replace(/[.,;)]$/, "");
  if (!raw) return null;
  const url = parsePublicEventUrl(raw);
  return ["tcringressos.com.br", "www.tcringressos.com.br"].includes(url.hostname) ? url.toString() : null;
}
export function cleanSourceText(html: string) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(?:p|br|li|div|h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t\r]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
function imageUrl(html: string, base: string) {
  const value = html.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
  if (!value) return "";
  try { return parsePublicEventUrl(new URL(value, base).toString()).toString(); } catch { return ""; }
}
export function parseLegacyImport(html: string, url: string): ImportSource {
  const heading = /<h4\b[^>]*class=["'][^"']*heading-main-title[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i.exec(html);
  const title = cleanSourceText(heading?.[1] || "");
  const fields = [...html.matchAll(/<div\b[^>]*class=["']imput-result clean text-black font-18["'][^>]*>([\s\S]*?)<\/div>/gi)].map(m => cleanSourceText(m[1]));
  const mapIndex = html.search(/>\s*Mapa do evento\s*</i);
  const descriptionMatch = html.match(/Informa[çc][õo]es sobre o evento[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i);
  const tickets = html.split(/<div\b[^>]*class=["']box box-sample box-border box-space box-radius column-12[^"']*["'][^>]*>/i).slice(1).map(block => {
    const name = cleanSourceText(block.match(/<a\b[^>]*class=["']text-black["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || "");
    const price = block.match(/R\$\s*([\d.]+,\d{2})/);
    const normalized = normalizeImportText(name);
    return { name, priceInCents: price ? Math.round(Number(price[1].replace(/\./g, "").replace(",", ".")) * 100) : 0,
      description: "", color: block.match(/border-left:\s*1rem solid (#[0-9a-f]{6})/i)?.[1] || "",
      infoId: block.match(/id=["']info_(\d+)["']/)?.[1] || "",
      needsOptions: /\b(mesa|camarote)\b/.test(normalized) && !/compartilhado|individual/.test(normalized),
      admissionsPerUnit: Number(normalized.match(/(?:para |de )?(\d+) pessoas/)?.[1] || (/\bduplo\b/.test(normalized) ? 2 : 1)),
      priceIsMinimum: /A partir de/i.test(block.split(/id=["']info_/)[0]) };
  });
  if (!title || !tickets.length || tickets.some(t => !t.name || !t.priceInCents) || new Set(tickets.map(t=>normalizeImportText(t.name))).size !== tickets.length) throw new Error("Não consegui extrair todos os ingressos com segurança. A estrutura da fonte precisa ser revisada.");
  const address = fields[3] || "";
  const location = address.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})\s*,/);
  const result: ImportSource = { url, fingerprint: "", title, dateText: fields[1] || "", venueName: fields[2] || "", venueAddress: address,
    city: location?.[1]?.trim() || "", state: location?.[2] || "", description: cleanSourceText(descriptionMatch?.[1] || ""),
    bannerUrl: imageUrl(html.slice(Math.max(0, html.lastIndexOf('<section', heading?.index || 0)), heading?.index || 0), url),
    mapUrl: mapIndex < 0 ? "" : imageUrl(html.slice(mapIndex), url), tickets,
    warnings: ["Confirme a data completa, incluindo o ano: o texto da fonte pode não informar o ano.", "Estoque, taxa de bilheteria, juros e limites por pedido precisam ser informados explicitamente.", "Unidades numeradas e preços 'a partir de' exigem conferência individual."] };
  // Banner is the event image immediately preceding the event heading, never the site logo.
  const before = html.slice(0, heading?.index || 0);
  const images = [...before.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)];
  if (images.length > 1) result.bannerUrl = imageUrl(images[images.length - 1][0], url);
  return result;
}
export function fingerprintImport(source: ImportSource) {
  return createHash("sha256").update(JSON.stringify({ ...source, fingerprint: "" })).digest("hex");
}
export async function readImportSource(url: string): Promise<ImportSource> {
  if (sourceUrl(url) !== url) throw new Error("Use uma referência pública da TCR antiga.");
  const page = await fetchPublicEventHtml(url);
  if (page.status !== 200) throw new Error(`A referência retornou HTTP ${page.status}.`);
  const source = parseLegacyImport(page.html, url);
  // Descriptions are public fragments from the information buttons on the same site.
  for (let offset = 0; offset < source.tickets.length; offset += 5) {
    await Promise.all(source.tickets.slice(offset, offset + 5).map(async ticket => {
      if (!ticket.infoId) return;
      try {
        const detail = await fetchPublicEventHtml(new URL(`/pages/ingress/self_ingress_price.php?searchTerm=${ticket.infoId}`, url).toString());
        if (detail.status === 200) ticket.description = cleanSourceText(detail.html).slice(0, 4000);
      } catch { /* Explicitly shown as missing in the review form. */ }
    }));
  }
  source.fingerprint = fingerprintImport(source);
  return importSourceSchema.parse(source);
}
