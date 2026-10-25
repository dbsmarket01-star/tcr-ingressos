import { Prisma, WhatsAppMessageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAdSalesCheckoutUrl, buildSorocabaQuantityUrl } from "@/features/whatsapp/ad-sales-checkout";
import { effectiveLotMaxPerOrder } from "@/features/orders/sorocaba-quantity-limit";
import { sendWhatsAppListMessage, sendWhatsAppMediaMessage, sendWhatsAppTextMessage, sendWhatsAppUrlButtonMessage } from "@/features/whatsapp/whatsapp.service";

const SLUG = "rodrigo-teaser-em-sorocaba-2026";
const SOURCE = "TCR_SOROCABA_SALES";
const SESSION_MS = 24 * 60 * 60_000;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Inbound = { organizationId: string; phone: string; text: string; replyToMessageId?: string | null; origin?: { kind?: string; adId?: string | null } };
type Session = { step?: string; group?: string; lotId?: string; optionId?: string; source?: string; eventSlug?: string; page?: number };
type Lot = { id: string; name: string; description: string | null; priceInCents: number; available: number; minPerOrder: number; maxPerOrder: number; admissionsPerUnit: number; options: Array<{ id: string; label: string }> };

export function isSorocabaAdGreeting(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /rodrigo\s+(teaser|tise|tis)/.test(normalized) && /sorocaba/.test(normalized) &&
    /(anuncio|interesse|ingresso|informac)/.test(normalized);
}

export function sorocabaGroup(name: string) {
  const value = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (value.includes("PRATA")) return "prata";
  if (value.includes("OURO")) return "ouro";
  if (value.includes("PRIMEIRA FILEIRA")) return "primeira";
  if (value.includes("MESA")) return "mesa";
  if (value.includes("CAMAROTE")) return "camarote";
  return "outros";
}

export function sorocabaLotLine(lot: Pick<Lot, "name" | "description" | "priceInCents" | "admissionsPerUnit">) {
  const badge = ({ prata: "⚪", ouro: "🟡", primeira: "🟢", mesa: "🟠", camarote: "🟣", outros: "🎟️" } as const)[sorocabaGroup(lot.name)];
  const details = lot.description?.trim();
  return `${badge} *${lot.name}*\n${money.format(lot.priceInCents / 100)} + taxas${lot.admissionsPerUnit > 1 ? ` · ${lot.admissionsPerUnit} pessoas` : ""}${details ? `\n${details}` : ""}`;
}

/** WhatsApp list titles have a 24-character limit; keep each category legible without cutting words. */
export function sorocabaLotChoiceTitle(name: string) {
  const group = sorocabaGroup(name);
  const upper = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (group === "prata" || group === "ouro") {
    const sector = group === "prata" ? "Prata" : "Ouro";
    if (upper.includes("MEIA")) return `${sector} · Meia-entrada`;
    if (upper.includes("SOLIDARIO")) return `${sector} · Solidário`;
  }
  if (group === "primeira") return "Primeira fileira";
  if (group === "mesa") return "Mesa para 4 pessoas";
  if (group === "camarote") {
    const number = upper.match(/CAMAROTE\s+(\d+)/)?.[1];
    if (upper.includes("COMPARTILHADO")) return number ? `Camarote ${number} compart.` : "Camarote compartilhado";
    if (upper.includes("FECHADO")) {
      const places = upper.match(/(?:PARA\s+)?(\d+)\s+PESSOAS/)?.[1];
      return places ? `Camarote fechado ${places}p` : "Camarote fechado";
    }
  }
  const words = name.trim().split(/\s+/);
  let title = "";
  for (const word of words) {
    if (`${title}${title ? " " : ""}${word}`.length > 24) break;
    title += `${title ? " " : ""}${word}`;
  }
  return title || name.slice(0, 24);
}

function sorocabaLotChoiceDescription(lot: Lot) {
  const price = `${money.format(lot.priceInCents / 100)} + taxas`;
  const description = lot.description || "";
  if (/1\s*kg/i.test(description)) return `${price} · levar 1 kg de alimento`;
  if (/comprovar/i.test(description)) return `${price} · comprovar meia-entrada`;
  if (/em p[eé]/i.test(description)) return `${price} · setor em pé`;
  return price;
}

async function loadEvent(organizationId: string) {
  const event = await prisma.event.findFirst({
    where: { organizationId, slug: SLUG, status: "PUBLISHED", startsAt: { gt: new Date() } },
    select: {
      id: true, title: true, startsAt: true, venueName: true, venueAddress: true, eventMapImageUrl: true,
      salesStartsAt: true, salesEndsAt: true,
      lots: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: {
        id: true, name: true, description: true, priceInCents: true, status: true, saleBadge: true,
        totalQuantity: true, reservedQuantity: true, soldQuantity: true,
        minPerOrder: true, maxPerOrder: true, admissionsPerUnit: true,
        salesStartsAt: true, salesEndsAt: true, hasTypeOptions: true,
        typeOptions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: {
          id: true, label: true, status: true, soldQuantity: true, reservedQuantity: true
        } }
      } }
    }
  });
  if (!event) return null;
  const now = new Date();
  if ((event.salesStartsAt && event.salesStartsAt > now) || (event.salesEndsAt && event.salesEndsAt <= now)) return null;
  const lots: Lot[] = event.lots.filter((lot) => lot.status === "ACTIVE" && lot.saleBadge !== "SOLD_OUT" &&
    lot.totalQuantity - lot.reservedQuantity - lot.soldQuantity > 0 &&
    (!lot.salesStartsAt || lot.salesStartsAt <= now) && (!lot.salesEndsAt || lot.salesEndsAt > now))
    .map((lot) => ({
      id: lot.id, name: lot.name, description: lot.description, priceInCents: lot.priceInCents,
      available: lot.totalQuantity - lot.reservedQuantity - lot.soldQuantity,
      minPerOrder: lot.minPerOrder, maxPerOrder: lot.maxPerOrder,
      admissionsPerUnit: lot.admissionsPerUnit,
      options: lot.hasTypeOptions ? lot.typeOptions.filter((option) => option.status === "ACTIVE" &&
        option.soldQuantity + option.reservedQuantity < 1).map((option) => ({ id: option.id, label: option.label })) : []
    })).filter((lot) => !event.lots.find((raw) => raw.id === lot.id)?.hasTypeOptions || lot.options.length > 0);
  return { ...event, lots };
}

async function latestSession(input: Inbound): Promise<Session | null> {
  if (input.replyToMessageId) {
    const repliedTo = await prisma.whatsAppMessageLog.findFirst({
      where: { organizationId: input.organizationId, providerMessageId: input.replyToMessageId,
        type: WhatsAppMessageType.BULK, payload: { path: ["source"], equals: SOURCE },
        status: { in: ["SENT", "DELIVERED", "READ"] },
        createdAt: { gte: new Date(Date.now() - SESSION_MS) } },
      select: { payload: true }
    });
    if (repliedTo?.payload) return repliedTo.payload as Session;
  }
  const normalized = input.phone.replace(/\D/g, "");
  const logs = await prisma.whatsAppMessageLog.findMany({
    where: { organizationId: input.organizationId, recipientPhone: { in: [input.phone, normalized, `+${normalized}`] },
      type: WhatsAppMessageType.BULK, payload: { path: ["source"], equals: SOURCE },
      status: { in: ["SENT", "DELIVERED", "READ"] },
      createdAt: { gte: new Date(Date.now() - SESSION_MS) } },
    select: { payload: true }, orderBy: { createdAt: "desc" }, take: 1
  });
  for (const log of logs) {
    const payload = log.payload as Prisma.JsonObject | null;
    if (payload?.source === SOURCE) return payload as Session;
  }
  return null;
}

async function text(input: Inbound, body: string, step: string, extra: Record<string, unknown> = {}) {
  await sendWhatsAppTextMessage({ to: input.phone, organizationId: input.organizationId, text: body,
    source: SOURCE, metadata: { step, eventSlug: SLUG, ...extra } });
}

async function list(input: Inbound, body: string, buttonText: string,
  rows: Array<{ id: string; title: string; description?: string }>, step: string, extra: Record<string, unknown> = {}) {
  await sendWhatsAppListMessage({ to: input.phone, organizationId: input.organizationId,
    text: body, buttonText, rows, source: SOURCE, metadata: { step, eventSlug: SLUG, ...extra } });
}

const menuRows = [
  { id: "prata", title: "⚪ Cadeira Prata", description: "Meia-entrada e solidário" },
  { id: "ouro", title: "🟡 Cadeira Ouro", description: "Meia-entrada e solidário" },
  { id: "primeira", title: "🟢 Primeira Fileira", description: "Ingresso exclusivo" },
  { id: "mesa", title: "🟠 Mesas", description: "Mesas para quatro pessoas" },
  { id: "camarote", title: "🟣 Camarotes", description: "Compartilhado ou fechado" }
];

const introRows = [
  { id: "tipos", title: "🎟️ Tipos de ingresso", description: "Ver o mapa e escolher um setor" }
];

function choice(input: string, rows: Array<{ id: string; title?: string }>) {
  const value = input.trim();
  if (/^\d+$/.test(value)) return rows[Number(value) - 1]?.id || null;
  return rows.find((row) => row.id === value || row.title?.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"))?.id || null;
}

async function mainMenu(input: Inbound, event: NonNullable<Awaited<ReturnType<typeof loadEvent>>>) {
  await list(input,
    `Olá! Que bom ter você aqui. Sou a assistente virtual da TCR Ingressos. 🎟️\n\n*${event.title}*\n📅 ${dateTime.format(event.startsAt)}\n📍 ${event.venueName}\n\n*Como posso ajudar?*\nToque em “Ver opções” e escolha *Tipos de ingresso* para receber o mapa do evento antes de selecionar seu setor. Também pode escrever sua dúvida livremente.\n\nSe preferir falar com nossa equipe, escreva *falar com atendente*.`,
    "Ver opções", introRows, "intro");
}

async function showSectorMenu(input: Inbound, event: NonNullable<Awaited<ReturnType<typeof loadEvent>>>) {
  const mapUrl = event.eventMapImageUrl?.trim();
  let mapSent = false;
  if (mapUrl && /^https:\/\/[^\s]+$/i.test(mapUrl)) {
    try {
      await sendWhatsAppMediaMessage({
        to: input.phone, kind: "image", mediaUrl: mapUrl,
        caption: `🗺️ *Mapa do evento: ${event.title}*\n\nSe a prévia aparecer embaçada no WhatsApp, toque na imagem para carregá-la ou abra o mapa original em alta qualidade: ${mapUrl}\n\nImagem ilustrativa; a disponibilidade é confirmada na escolha do ingresso.`,
        organizationId: input.organizationId, eventId: event.id,
        metadata: { source: SOURCE, step: "map_preview", eventSlug: SLUG }
      });
      mapSent = true;
    } catch (error) {
      console.error("[WhatsApp Sorocaba] Não foi possível enviar o mapa como imagem", error);
    }
  }
  if (!mapSent) {
    await text(input, `🗺️ Veja o mapa do evento na página oficial: https://www.tcringressos.app.br/evento/${SLUG}`, "map_preview");
  }
  await list(input,
    "*Agora escolha a opção que mais combina com você.* 🎟️\n\nVeja os setores, valores e ingressos disponíveis. Toque em “Escolher opção” para continuar:",
    "Escolher opção", menuRows, "menu");
}

async function showChosenLot(input: Inbound, event: NonNullable<Awaited<ReturnType<typeof loadEvent>>>, lot: Lot) {
  if (lot.options.length) {
    const rows: Array<{ id: string; title: string; description?: string }> = lot.options.slice(0, 9).map((option) => ({ id: option.id, title: option.label, description: `${money.format(lot.priceInCents / 100)} + taxas` }));
    if (lot.options.length > 9) rows.push({ id: "more", title: "Ver mais números", description: "Outras mesas disponíveis" });
    await list(input, `${sorocabaLotLine(lot)}\n\n*Escolha o número disponível.* Cada unidade dá acesso a ${lot.admissionsPerUnit} pessoa(s).`,
      "Escolher número", rows, "option", { lotId: lot.id, page: 0 });
    return;
  }
  const maximum = Math.min(effectiveLotMaxPerOrder(SLUG, { ...lot, hasTypeOptions: false }), lot.available);
  if (maximum < Math.max(1, lot.minPerOrder)) {
    await text(input, "Este ingresso não tem quantidade suficiente para o pedido mínimo agora. Responda *menu* para escolher outro setor.", "info");
    return;
  }
  await sendWhatsAppUrlButtonMessage({ to: input.phone, organizationId: input.organizationId, eventId: event.id,
    text: `${sorocabaLotLine(lot)}\n\nEscolha de *${Math.max(1, lot.minPerOrder)} a ${maximum} ingressos* no controle − / +. Você verá o resumo e as taxas antes de pagar.`,
    buttonText: "Escolher quantidade", url: buildSorocabaQuantityUrl({ lotId: lot.id, adId: input.origin?.adId }),
    source: SOURCE, metadata: { step: "done", eventSlug: SLUG, lotId: lot.id } });
}

/** Returns false for a free-form question so the regular humanized AI can answer it. */
export async function processSorocabaSalesJourney(input: Inbound): Promise<boolean> {
  const session = await latestSession(input);
  const greeting = isSorocabaAdGreeting(input.text);
  if (!session && !greeting) return false;
  if (/^(sair|cancelar|parar|falar com (atendente|suporte))$/i.test(input.text.trim())) return false;
  const event = await loadEvent(input.organizationId);
  if (!event) return false;
  if (greeting || !session) { await mainMenu(input, event); return true; }
  if (/^menu$/i.test(input.text.trim())) { await mainMenu(input, event); return true; }

  if (session.step === "intro") {
    const selected = choice(input.text, introRows);
    if (selected === "tipos") { await showSectorMenu(input, event); return true; }
    return false;
  }

  if (session.step === "menu") {
    const selected = choice(input.text, menuRows);
    if (!selected) return false;
    const lots = event.lots.filter((lot) => sorocabaGroup(lot.name) === selected);
    if (!lots.length) {
      await text(input, "*Essa categoria está indisponível no momento.*\n\nResponda *menu* para conhecer as outras opções ou escreva sua dúvida. Vou ajudar você a encontrar a melhor alternativa.", "info");
      return true;
    }
    if (selected === "primeira" && lots.length === 1) {
      await showChosenLot(input, event, lots[0]);
      return true;
    }
    await list(input, `*Ingressos disponíveis*\n\n${lots.map(sorocabaLotLine).join("\n\n")}\n\n*Qual você prefere?* Toque em “Escolher ingresso”. O total com taxas aparece no checkout antes do pagamento.`,
      "Escolher ingresso", lots.map((lot) => ({ id: lot.id, title: sorocabaLotChoiceTitle(lot.name), description: sorocabaLotChoiceDescription(lot) })),
      "lot", { group: selected });
    return true;
  }

  if (session.step === "lot") {
    const lots = event.lots.filter((lot) => sorocabaGroup(lot.name) === session.group);
    const selectedId = choice(input.text, lots.map((entry) => ({ id: entry.id, title: sorocabaLotChoiceTitle(entry.name) })));
    const lot = lots.find((item) => item.id === selectedId || item.name.toLocaleLowerCase("pt-BR") === input.text.trim().toLocaleLowerCase("pt-BR"));
    if (!lot) return false;
    await showChosenLot(input, event, lot);
    return true;
  }

  if (session.step === "option") {
    const lot = event.lots.find((item) => item.id === session.lotId);
    if (!lot) return false;
    const page = Number(session.page || 0);
    const options = lot.options.slice(page * 9, page * 9 + 9);
    const selected = choice(input.text, [...options.map((option) => ({ id: option.id, title: option.label })), { id: "more", title: "Ver mais números" }]);
    if (selected === "more") {
      const nextPage = page + 1;
      const next = lot.options.slice(nextPage * 9, nextPage * 9 + 9);
      if (!next.length) return false;
      const rows: Array<{ id: string; title: string; description?: string }> = next.map((option) => ({ id: option.id, title: option.label, description: `${money.format(lot.priceInCents / 100)} + taxas` }));
      if (lot.options.length > (nextPage + 1) * 9) rows.push({ id: "more", title: "Ver mais números" });
      await list(input, "*Mais números disponíveis*\n\nEscolha a mesa ou o camarote que você prefere:", "Escolher número", rows, "option", { lotId: lot.id, page: nextPage });
      return true;
    }
    const option = lot.options.find((item) => item.id === selected);
    if (!option) return false;
    const url = buildAdSalesCheckoutUrl({ eventSlug: SLUG, lotId: lot.id, lotOptionId: option.id, quantity: 1, adId: input.origin?.adId });
    await sendWhatsAppUrlButtonMessage({ to: input.phone, organizationId: input.organizationId, eventId: event.id,
      text: `*Sua escolha:* ${option.label}\n${lot.name}\n\n*Valor:* ${money.format(lot.priceInCents / 100)} + taxas · ${lot.admissionsPerUnit} pessoas.\n\nToque em *Comprar ingresso* para conferir o resumo, as taxas e a disponibilidade final antes de pagar.`,
      buttonText: "Comprar ingresso", url, source: SOURCE, metadata: { step: "done", eventSlug: SLUG, lotId: lot.id, optionId: option.id } });
    return true;
  }

  if (session.step === "quantity") {
    const lot = event.lots.find((item) => item.id === session.lotId);
    const quantity = Number(input.text.trim().match(/^\d+/)?.[0]);
    if (!lot || !Number.isInteger(quantity) || quantity < Math.max(1, lot.minPerOrder) ||
        quantity > Math.min(effectiveLotMaxPerOrder(SLUG, { ...lot, hasTypeOptions: false }), lot.available)) return false;
    const url = buildAdSalesCheckoutUrl({ eventSlug: SLUG, lotId: lot.id, quantity, adId: input.origin?.adId });
    await sendWhatsAppUrlButtonMessage({ to: input.phone, organizationId: input.organizationId, eventId: event.id,
      text: `*Sua escolha:* ${quantity} ingresso(s)\n${lot.name}\n\n*Valor dos ingressos:* ${money.format(lot.priceInCents * quantity / 100)} + taxas.\n\nToque em *Comprar ingresso* para conferir o resumo e o total antes de pagar.`,
      buttonText: "Comprar ingresso", url, source: SOURCE, metadata: { step: "done", eventSlug: SLUG, lotId: lot.id, quantity } });
    return true;
  }
  return false;
}
