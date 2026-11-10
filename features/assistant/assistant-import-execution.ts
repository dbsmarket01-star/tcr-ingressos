import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createEvent } from "@/features/events/event.service";
import { eventDraftSchema } from "@/features/events/event.schema";
import { createTicketLot } from "@/features/lots/lot.service";
import { ticketLotSchema } from "@/features/lots/lot.schema";
import { lockEventLotOrder, normalizeEventLotOrder } from "@/features/lots/lot-order.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";
import { getPublicEventUrl } from "@/lib/public-url";
import { fetchPublicImageBytes, fetchPublicEventHtml } from "./public-event-source";
import { cleanSourceText, importPlanSchema, normalizeImportText, readImportSource, type ImportPlan, type ImportSource } from "./assistant-event-import";

export async function findImportDuplicates(organizationId: string, source: Pick<ImportSource, "title" | "city">, db: Pick<Prisma.TransactionClient, "event"> = prisma) {
  const events = await db.event.findMany({ where: { organizationId }, select: { id: true, title: true, city: true, startsAt: true, slug: true, status: true } });
  // Conservative: a new edition with the same identity requires manual disambiguation.
  const identity = (title: string) => normalizeImportText(title).replace(/\b20\d{2}\b/g, "").replace(/\s+/g, " ").trim();
  const sourceTitle = identity(source.title);
  return events.filter(event => (identity(event.title) === sourceTitle || (sourceTitle.length >= 8 && identity(event.title).length >= 8 && (sourceTitle.includes(identity(event.title)) || identity(event.title).includes(sourceTitle)))) &&
    (!source.city || normalizeImportText(event.city) === normalizeImportText(source.city)));
}
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function copyImportImage(url: string, folder: string) {
  const bytes = await fetchPublicImageBytes(url);
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format || "")) throw new Error("Use mídia JPG, PNG ou WEBP válida.");
  const uploaded = await savePublicImageUpload(new File([new Uint8Array(bytes)], `source.${metadata.format}`, { type: `image/${metadata.format}` }), folder);
  if (process.env.NODE_ENV === "development" && uploaded?.startsWith("/uploads/")) {
    const root = path.resolve(process.cwd(), "public/uploads");
    const file = path.resolve(process.cwd(), `public${uploaded}`);
    if (!file.startsWith(`${root}${path.sep}`) || digest(await readFile(file)) !== digest(bytes)) throw new Error("Mídia local divergente da fonte.");
    return uploaded;
  }
  if (!uploaded?.startsWith("https://")) throw new Error("Configure armazenamento público HTTPS antes de importar.");
  const stored = await fetchPublicImageBytes(uploaded);
  if (digest(stored) !== digest(bytes)) throw new Error("A imagem armazenada não corresponde ao arquivo da fonte.");
  return uploaded;
}
export async function executeEventImport(organizationId: string, proposalId: string, input: ImportPlan) {
  const plan = importPlanSchema.parse(input);
  const latest = await readImportSource(plan.source.url);
  if (latest.fingerprint !== plan.source.fingerprint) throw new Error("A fonte mudou desde a proposta. Leia o link novamente e revise.");
  if ((await findImportDuplicates(organizationId, plan.source)).length) throw new Error("Já existe um evento correspondente. Nenhuma duplicata foi criada.");
  if (new Date(plan.startsAt).getTime() <= Date.now()) throw new Error("A data do evento precisa estar no futuro.");
  const slug = `${normalizeImportText(plan.source.title).replace(/ /g, "-")}-${plan.startsAt.slice(0, 10)}`;
  // Copy and verify all media BEFORE creating any event or ticket.
  const bannerUrl = await copyImportImage(plan.source.bannerUrl, `events/${slug}/banner`);
  const eventMapImageUrl = plan.source.mapUrl ? await copyImportImage(plan.source.mapUrl, `events/${slug}/map`) : "";
  const draft = eventDraftSchema.parse({ title: plan.source.title, slug, description: plan.source.description,
    startsAt: plan.startsAt, venueName: plan.venueName, venueAddress: plan.venueAddress, city: plan.city,
    state: plan.state, bannerUrl, eventMapImageUrl });
  const event = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assistant-import:${organizationId}`}))`;
    if ((await findImportDuplicates(organizationId, { ...plan.source, city: plan.city }, tx)).length) throw new Error("Outro cadastro correspondente apareceu. Importação cancelada.");
    const created = await createEvent({ ...draft, status: "DRAFT" }, organizationId, tx);
    for (let index = 0; index < plan.source.tickets.length; index++) {
      const source = plan.source.tickets[index], settings = plan.tickets[index];
      const ticket = ticketLotSchema.parse({ eventId: created.id, name: source.name, description: settings.description,
        highlightColor: source.color, priceInCents: settings.priceInCents, totalQuantity: settings.quantity,
        admissionsPerUnit: settings.admissionsPerUnit, hasTypeOptions: settings.options.length > 0,
        typeOptionsText: settings.options.join("\n"), serviceFeeBps: plan.serviceFeeBps,
        cardInterestBpsPerInstallment: plan.cardInterestBpsPerInstallment,
        cardInterestStartsAtInstallment: plan.cardInterestStartsAtInstallment,
        minPerOrder: plan.minPerOrder, maxPerOrder: plan.maxPerOrder });
      await createTicketLot({ ...ticket, status: "ACTIVE" }, tx);
    }
    await lockEventLotOrder(tx, created.id);
    await normalizeEventLotOrder(tx, created.id);
    const verified = await tx.event.findUniqueOrThrow({ where: { id: created.id }, include: { lots: { include: { typeOptions: true }, orderBy: { sortOrder: "asc" } } } });
    if (verified.lots.length !== plan.tickets.length || verified.bannerUrl !== bannerUrl || verified.eventMapImageUrl !== (eventMapImageUrl || null)) throw new Error("Cadastro não passou na verificação final.");
    for (const [index, source] of plan.source.tickets.entries()) {
      const lot = verified.lots.find(item => item.name === source.name), settings = plan.tickets[index];
      if (!lot || lot.priceInCents !== settings.priceInCents || lot.totalQuantity !== settings.quantity || lot.admissionsPerUnit !== settings.admissionsPerUnit || lot.serviceFeeBps !== plan.serviceFeeBps || lot.typeOptions.length !== settings.options.length) throw new Error("Ingresso divergente da proposta.");
    }
    const final = await tx.event.update({ where: { id: created.id }, data: { status: plan.publish ? "PUBLISHED" : "DRAFT" } });
    await tx.adminAuditLog.create({ data: { id: `assistant-import-result:${proposalId}`, action: "ADMIN_ASSISTANT_IMPORT_RESULT", entityType: "ADMIN_ASSISTANT", entityId: proposalId,
      metadata: { organizationId, eventId: final.id, slug: final.slug, sourceUrl: plan.source.url, sourceFingerprint: plan.source.fingerprint } } });
    return { id: final.id, slug: final.slug, status: final.status };
  }, { timeout: 60_000 });
  return event;
}
export async function verifyImportedPublicPage(organizationId: string, slug: string, plan: ImportPlan) {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { publicDomain: true } });
  const url = getPublicEventUrl(slug, organization).replace(/^https:\/\/tcringressos\.app\.br\//, "https://www.tcringressos.app.br/");
  if (!plan.publish) return { ok: true, url, detail: "Rascunho mantido fora do site público por escolha explícita." };
  try {
    const local = new URL(url);
    const result = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(local.hostname)
      ? await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), cache: "no-store" }).then(async response => ({ status: response.status, html: await response.text() }))
      : await fetchPublicEventHtml(url);
    const text = cleanSourceText(result.html);
    const ticketsVisible = plan.source.tickets.every((ticket, index) => text.includes(ticket.name) && text.includes((plan.tickets[index].priceInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })));
    const ok = result.status === 200 && text.includes(plan.source.title) && ticketsVisible;
    return { ok, url, detail: `Página pública HTTP ${result.status}. ${ok ? "Título, ingressos e preços conferidos." : "Conferência do conteúdo pendente."}` };
  } catch { return { ok: false, url, detail: "Cadastro salvo, mas a verificação pública não respondeu. Não repita a importação; confira o evento criado." }; }
}
