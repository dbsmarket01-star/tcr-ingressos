import { Prisma, WhatsAppMessageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadPilotSalesEvents, isPilotAd } from "@/features/whatsapp/ad-sales-catalog";
import { buildAdSalesCheckoutUrl } from "@/features/whatsapp/ad-sales-checkout";
import { sendWhatsAppListMessage, sendWhatsAppTextMessage, sendWhatsAppUrlButtonMessage } from "@/features/whatsapp/whatsapp.service";

const SALES_SOURCE = "TCR_WHATSAPP_AD_SALES";
const SESSION_MS = 30 * 60_000;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatSalesLotChoice(lot: { name: string; priceInCents: number }) {
  const normalized = lot.name.replace(/^(CADEIRA|SETOR)\s+/i, "").trim();
  const [sector, kind] = normalized.split(/\s+-\s+/, 2);
  const sectorLabel = sector.toLocaleLowerCase("pt-BR").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
  const kindLabel = kind?.toLocaleLowerCase("pt-BR").replace("meia entrada", "meia-entrada");
  const title = kindLabel && kindLabel !== "exclusivo" ? `${sectorLabel} · ${kindLabel[0].toLocaleUpperCase("pt-BR")}${kindLabel.slice(1)}` : sectorLabel;
  return {
    title,
    description: `${kindLabel === "exclusivo" ? "Exclusivo · " : ""}${brl.format(lot.priceInCents / 100)} + taxas`
  };
}

type Inbound = { organizationId: string; phone: string; text: string; origin?: { kind?: string; adId?: string | null } };
type Session = { step?: string; eventSlug?: string; lotId?: string; adId?: string; options?: string[]; source?: string };

function digits(phone: string) { return phone.replace(/\D/g, ""); }

export function isAuthorizedAdSalesTestKeyword(input: Inbound): boolean {
  const allowedPhones = (process.env.WHATSAPP_SALES_TEST_PHONES || "")
    .split(",").map(digits).filter(Boolean);
  const keyword = (process.env.WHATSAPP_SALES_TEST_KEYWORD || "Diego teste 123").trim();
  return Boolean(keyword && allowedPhones.includes(digits(input.phone)) &&
    input.text.trim().toLocaleLowerCase("pt-BR") === keyword.toLocaleLowerCase("pt-BR"));
}

async function latestSession(organizationId: string, phone: string): Promise<Session | null> {
  const normalized = digits(phone);
  const variants = Array.from(new Set([phone, normalized, `+${normalized}`]));
  const logs = await prisma.whatsAppMessageLog.findMany({
    where: {
      organizationId,
      recipientPhone: { in: variants },
      type: WhatsAppMessageType.BULK,
      status: { in: ["SENT", "DELIVERED", "READ"] },
      createdAt: { gte: new Date(Date.now() - SESSION_MS) }
    },
    select: { payload: true },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  for (const log of logs) {
    const payload = log.payload as Prisma.JsonObject | null;
    if (payload?.source === SALES_SOURCE) return payload as Session;
  }
  return null;
}

async function sendStep(input: Inbound, text: string, step: string, eventSlug?: string, options?: string[], lotId?: string, adId?: string) {
  await sendWhatsAppTextMessage({
    to: input.phone,
    text,
    organizationId: input.organizationId,
    source: SALES_SOURCE,
    metadata: { step, ...(eventSlug ? { eventSlug } : {}), ...(options ? { options } : {}), ...(lotId ? { lotId } : {}), ...(adId ? { adId } : {}) }
  });
}

async function sendChoice(input: Inbound, text: string, step: string, rows: Array<{ title: string; description?: string }>, eventSlug?: string, options?: string[], lotId?: string, adId?: string) {
  await sendWhatsAppListMessage({
    to: input.phone,
    organizationId: input.organizationId,
    text,
    buttonText: "Ver opções",
    rows: rows.map((row, index) => ({ id: String(index + 1), title: row.title, description: row.description })),
    source: SALES_SOURCE,
    metadata: { step, ...(eventSlug ? { eventSlug } : {}), ...(options ? { options } : {}), ...(lotId ? { lotId } : {}), ...(adId ? { adId } : {}) }
  });
}

/** Returns false when the existing support assistant should handle the message. */
export async function processAdSalesJourney(input: Inbound): Promise<boolean> {
  if (/quero tirar uma d[uú]vida no site/i.test(input.text)) return false;
  const session = await latestSession(input.organizationId, input.phone);
  const approvedAd = input.origin?.kind === "meta_ad" && isPilotAd(input.origin.adId);
  const authorizedTest = isAuthorizedAdSalesTestKeyword(input);
  if ((!session || session.step === "done") && !approvedAd && !authorizedTest) return false;
  const adId = approvedAd ? input.origin?.adId || undefined : session?.adId;

  const events = await loadPilotSalesEvents(input.organizationId);
  if (!events.length) return false;
  const choice = input.text.trim();
  if (session && /^(sair|cancelar|parar|falar com suporte)$/i.test(choice)) return false;

  if (!session || session.step === "done" || authorizedTest) {
    await sendChoice(input,
      "Que bom ter você aqui! Qual evento Geriatricus deseja conhecer? Toque em Ver opções para escolher. Se preferir atendimento humano, escreva 'falar com atendente'.",
      "choose_event", events.map((event) => ({ title: event.slug.includes("suzano") ? "Suzano" : "Santo André", description: event.title })), undefined, events.map((event) => event.slug), undefined, adId);
    return true;
  }

  if (session.step === "choose_event") {
    if (!/^\d+$/.test(choice)) return false;
    const selected = events.find((event) => event.slug === session.options?.[Number(choice) - 1]);
    if (!selected) {
      await sendChoice(input, "Escolha um dos eventos disponíveis:", "choose_event", events.map((event) => ({ title: event.slug.includes("suzano") ? "Suzano" : "Santo André", description: event.title })), undefined, events.map((event) => event.slug), undefined, adId);
      return true;
    }
    await sendChoice(input,
      `${selected.title}\nEscolha seu ingresso em Ver opções. Cada valor aparece com “+ taxas”; o total exato estará no resumo antes de informar seus dados.`,
      "choose_lot", selected.lots.map(formatSalesLotChoice), selected.slug, selected.lots.map((lot) => lot.id), undefined, adId);
    return true;
  }

  if (session.step === "choose_lot") {
    const event = events.find((item) => item.slug === session.eventSlug);
    if (!event) return false;
    if (!/^\d+$/.test(choice)) return false;
    const selected = event.lots.find((lot) => lot.id === session.options?.[Number(choice) - 1]);
    if (!selected) {
      await sendChoice(input, "Essa opção não está mais disponível. Escolha novamente em Ver opções:", "choose_lot", event.lots.map(formatSalesLotChoice), event.slug, event.lots.map((lot) => lot.id), undefined, adId);
      return true;
    }
    const minimum = Math.max(selected.minPerOrder || 1, 1);
    const maximum = Math.min(selected.maxPerOrder || 10, selected.available, 10);
    await sendWhatsAppListMessage({
      to: input.phone, organizationId: input.organizationId,
      text: `Você escolheu ${selected.name} para ${event.title}. Quantos ingressos deseja?`,
      buttonText: "Quantidade",
      rows: Array.from({ length: maximum - minimum + 1 }, (_, index) => {
        const quantity = minimum + index;
        return { id: String(quantity), title: `${quantity} ingresso${quantity > 1 ? "s" : ""}` };
      }),
      source: SALES_SOURCE,
      metadata: { step: "choose_quantity", eventSlug: event.slug, lotId: selected.id, ...(adId ? { adId } : {}) }
    });
    return true;
  }
  if (session.step === "choose_quantity") {
    const event = events.find((item) => item.slug === session.eventSlug);
    const lot = event?.lots.find((item) => item.id === session.lotId);
    if (!event || !lot) return false;
    if (!/^\d+$/.test(choice)) return false;
    const quantity = Number(choice);
    const minimum = Math.max(lot.minPerOrder || 1, 1);
    const maximum = Math.min(lot.maxPerOrder || 10, lot.available, 10);
    if (quantity < minimum || quantity > maximum) {
      await sendStep(input, `Para ${lot.name}, escolha entre ${minimum} e ${maximum} ingressos. Você pode responder com o número desejado.`, "choose_quantity", event.slug, undefined, lot.id, adId);
      return true;
    }
    const url = buildAdSalesCheckoutUrl({ eventSlug: event.slug, lotId: lot.id, quantity, adId });
    await sendWhatsAppUrlButtonMessage({
      to: input.phone,
      organizationId: input.organizationId,
      eventId: event.id,
      text: `${quantity} ingresso(s) · ${lot.name}\nValor dos ingressos: ${brl.format(lot.priceInCents * quantity / 100)} + taxas.\n\nToque em Comprar ingresso para ver primeiro o resumo completo e, abaixo, informar seus dados no site seguro da TCR.`,
      buttonText: "Comprar ingresso",
      url,
      source: SALES_SOURCE,
      metadata: { step: "done", eventSlug: event.slug, lotId: lot.id, quantity, ...(adId ? { adId } : {}) }
    });
    return true;
  }
  return false;
}
