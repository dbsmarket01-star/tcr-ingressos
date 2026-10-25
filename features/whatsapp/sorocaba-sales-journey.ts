import { Prisma, WhatsAppMessageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAdSalesCheckoutUrl } from "@/features/whatsapp/ad-sales-checkout";
import { sendWhatsAppListMessage, sendWhatsAppTextMessage, sendWhatsAppUrlButtonMessage } from "@/features/whatsapp/whatsapp.service";

const SLUG = "rodrigo-teaser-em-sorocaba-2026";
const SOURCE = "TCR_SOROCABA_SALES";
const SESSION_MS = 24 * 60 * 60_000;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Inbound = { organizationId: string; phone: string; text: string; origin?: { kind?: string; adId?: string | null } };
type Session = { step?: string; group?: string; lotId?: string; optionId?: string; source?: string; eventSlug?: string; page?: number };
type Lot = { id: string; name: string; priceInCents: number; available: number; minPerOrder: number; maxPerOrder: number; admissionsPerUnit: number; options: Array<{ id: string; label: string }> };

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

export function sorocabaLotLine(lot: Pick<Lot, "name" | "priceInCents" | "admissionsPerUnit">) {
  const badge = ({ prata: "⚪", ouro: "🟡", primeira: "🟢", mesa: "🟠", camarote: "🟣", outros: "🎟️" } as const)[sorocabaGroup(lot.name)];
  return `${badge} *${lot.name}*\n${money.format(lot.priceInCents / 100)} + taxas${lot.admissionsPerUnit > 1 ? ` · ${lot.admissionsPerUnit} pessoas` : ""}`;
}

async function loadEvent(organizationId: string) {
  const event = await prisma.event.findFirst({
    where: { organizationId, slug: SLUG, status: "PUBLISHED", startsAt: { gt: new Date() } },
    select: {
      id: true, title: true, startsAt: true, venueName: true, venueAddress: true,
      salesStartsAt: true, salesEndsAt: true,
      lots: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: {
        id: true, name: true, priceInCents: true, status: true, saleBadge: true,
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
      id: lot.id, name: lot.name, priceInCents: lot.priceInCents,
      available: lot.totalQuantity - lot.reservedQuantity - lot.soldQuantity,
      minPerOrder: lot.minPerOrder, maxPerOrder: lot.maxPerOrder,
      admissionsPerUnit: lot.admissionsPerUnit,
      options: lot.hasTypeOptions ? lot.typeOptions.filter((option) => option.status === "ACTIVE" &&
        option.soldQuantity + option.reservedQuantity < 1).map((option) => ({ id: option.id, label: option.label })) : []
    })).filter((lot) => !event.lots.find((raw) => raw.id === lot.id)?.hasTypeOptions || lot.options.length > 0);
  return { ...event, lots };
}

async function latestSession(input: Inbound): Promise<Session | null> {
  const normalized = input.phone.replace(/\D/g, "");
  const logs = await prisma.whatsAppMessageLog.findMany({
    where: { organizationId: input.organizationId, recipientPhone: { in: [input.phone, normalized, `+${normalized}`] },
      type: WhatsAppMessageType.BULK, status: { in: ["SENT", "DELIVERED", "READ"] },
      createdAt: { gte: new Date(Date.now() - SESSION_MS) } },
    select: { payload: true }, orderBy: { createdAt: "desc" }, take: 30
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
  { id: "camarote", title: "🟣 Camarotes", description: "Compartilhado ou fechado" },
  { id: "local", title: "📍 Local e horário" },
  { id: "pagamento", title: "💳 Pagamento" }
];

function choice(input: string, rows: Array<{ id: string; title?: string }>) {
  const value = input.trim();
  if (/^\d+$/.test(value)) return rows[Number(value) - 1]?.id || null;
  return rows.find((row) => row.id === value || row.title?.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"))?.id || null;
}

async function mainMenu(input: Inbound, event: NonNullable<Awaited<ReturnType<typeof loadEvent>>>) {
  await list(input,
    `Olá! Que bom ter você aqui. Sou a assistente virtual da TCR Ingressos. 🎟️\n\n*${event.title}*\n📅 ${dateTime.format(event.startsAt)}\n📍 ${event.venueName}\n\n*Como posso ajudar você a escolher seu ingresso?*\nToque em “Ver opções” para conferir setores, valores e outras informações. Também pode escrever sua dúvida livremente.\n\nSe preferir falar com nossa equipe, escreva *falar com atendente*.`,
    "Ver opções", menuRows, "menu");
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

  if (session.step === "menu") {
    const selected = choice(input.text, menuRows);
    if (!selected) return false;
    if (selected === "local") {
      await text(input, `*${event.title}*\n\n📅 *Data e horário:* ${dateTime.format(event.startsAt)}\n📍 *Local:* ${event.venueName}\n${event.venueAddress}\n\nQuer conhecer os ingressos? Responda *menu*. Se preferir, escreva sua dúvida.`, "info");
      return true;
    }
    if (selected === "pagamento") {
      await text(input, "*Pagamento e taxas* 💳\n\nOs valores que mostramos aqui são dos ingressos, *+ taxas*. No checkout seguro da TCR você confere as formas de pagamento disponíveis e o *total antes de finalizar* — sem compromisso.\n\nPara ver os setores e escolher seu ingresso, responda *menu*. Se tiver alguma dúvida, pode perguntar por aqui.", "info");
      return true;
    }
    const lots = event.lots.filter((lot) => sorocabaGroup(lot.name) === selected);
    if (!lots.length) {
      await text(input, "*Essa categoria está indisponível no momento.*\n\nResponda *menu* para conhecer as outras opções ou escreva sua dúvida. Vou ajudar você a encontrar a melhor alternativa.", "info");
      return true;
    }
    await list(input, `*Ingressos disponíveis*\n\n${lots.map(sorocabaLotLine).join("\n\n")}\n\n*Qual você prefere?* Toque em “Escolher ingresso”. O total com taxas aparece no checkout antes do pagamento.`,
      "Escolher ingresso", lots.map((lot) => ({ id: lot.id, title: lot.name.slice(0, 24), description: `${money.format(lot.priceInCents / 100)} + taxas` })),
      "lot", { group: selected });
    return true;
  }

  if (session.step === "lot") {
    const lots = event.lots.filter((lot) => sorocabaGroup(lot.name) === session.group);
    const selectedId = choice(input.text, lots.map((entry) => ({ id: entry.id, title: entry.name.slice(0, 24) })));
    const lot = lots.find((item) => item.id === selectedId || item.name.toLocaleLowerCase("pt-BR") === input.text.trim().toLocaleLowerCase("pt-BR"));
    if (!lot) return false;
    if (lot.options.length) {
      const rows: Array<{ id: string; title: string; description?: string }> = lot.options.slice(0, 9).map((option) => ({ id: option.id, title: option.label, description: `${money.format(lot.priceInCents / 100)} + taxas` }));
      if (lot.options.length > 9) rows.push({ id: "more", title: "Ver mais números", description: "Outras mesas disponíveis" });
      await list(input, `${sorocabaLotLine(lot)}\n\n*Escolha o número disponível.* Cada unidade dá acesso a ${lot.admissionsPerUnit} pessoa(s).`,
        "Escolher número", rows, "option", { lotId: lot.id, page: 0 });
      return true;
    }
    const minimum = Math.max(1, lot.minPerOrder);
    const maximum = Math.min(10, lot.maxPerOrder, lot.available);
    await list(input, `${sorocabaLotLine(lot)}\n\n*Quantos ingressos você deseja?*`, "Quantidade",
      Array.from({ length: maximum - minimum + 1 }, (_, index) => ({ id: String(minimum + index), title: `${minimum + index} ingresso${minimum + index > 1 ? "s" : ""}` })),
      "quantity", { lotId: lot.id });
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
        quantity > Math.min(10, lot.maxPerOrder, lot.available)) return false;
    const url = buildAdSalesCheckoutUrl({ eventSlug: SLUG, lotId: lot.id, quantity, adId: input.origin?.adId });
    await sendWhatsAppUrlButtonMessage({ to: input.phone, organizationId: input.organizationId, eventId: event.id,
      text: `*Sua escolha:* ${quantity} ingresso(s)\n${lot.name}\n\n*Valor dos ingressos:* ${money.format(lot.priceInCents * quantity / 100)} + taxas.\n\nToque em *Comprar ingresso* para conferir o resumo e o total antes de pagar.`,
      buttonText: "Comprar ingresso", url, source: SOURCE, metadata: { step: "done", eventSlug: SLUG, lotId: lot.id, quantity } });
    return true;
  }
  return false;
}
