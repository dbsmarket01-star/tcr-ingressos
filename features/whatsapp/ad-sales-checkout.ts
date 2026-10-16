import { PILOT_EVENT_SLUGS } from "@/features/whatsapp/ad-sales-catalog";

export function buildAdSalesCheckoutUrl(input: {
  eventSlug: string;
  lotId: string;
  quantity: number;
  adId?: string | null;
}) {
  if (!PILOT_EVENT_SLUGS.includes(input.eventSlug as typeof PILOT_EVENT_SLUGS[number])) {
    throw new Error("Evento fora do piloto de vendas no WhatsApp.");
  }
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.lotId)) throw new Error("Ingresso inválido.");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    throw new Error("Quantidade inválida.");
  }
  const url = new URL(`/evento/${input.eventSlug}/checkout`, "https://www.tcringressos.app.br");
  url.searchParams.set("lotId", input.lotId);
  url.searchParams.set(`quantity_${input.lotId}`, String(input.quantity));
  url.searchParams.set("utm_source", "whatsapp");
  url.searchParams.set("utm_medium", "meta_ads");
  url.searchParams.set("utm_campaign", "geriatricus_whatsapp_piloto");
  if (input.adId && /^\d{1,30}$/.test(input.adId)) url.searchParams.set("utm_content", input.adId);
  url.hash = "resumo";
  return url.toString();
}
