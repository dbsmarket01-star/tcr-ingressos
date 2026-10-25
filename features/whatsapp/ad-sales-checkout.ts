import { PILOT_EVENT_SLUGS } from "@/features/whatsapp/ad-sales-catalog";
import { SOROCABA_EVENT_SLUG } from "@/features/orders/sorocaba-quantity-limit";

export function buildSorocabaQuantityUrl(input: { lotId: string; adId?: string | null; paidAd?: boolean }) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.lotId)) throw new Error("Ingresso inválido.");
  const url = new URL(`/evento/${SOROCABA_EVENT_SLUG}/quantidade`, "https://www.tcringressos.app.br");
  url.searchParams.set("lotId", input.lotId);
  if (input.paidAd) url.searchParams.set("paidAd", "1");
  if (input.adId && /^\d{1,30}$/.test(input.adId)) url.searchParams.set("adId", input.adId);
  return url.toString();
}

export function buildAdSalesCheckoutUrl(input: {
  eventSlug: string;
  lotId: string;
  quantity: number;
  lotOptionId?: string | null;
  adId?: string | null;
  paidAd?: boolean;
}) {
  if (!PILOT_EVENT_SLUGS.includes(input.eventSlug as typeof PILOT_EVENT_SLUGS[number]) &&
      input.eventSlug !== "rodrigo-teaser-em-sorocaba-2026") {
    throw new Error("Evento fora do piloto de vendas no WhatsApp.");
  }
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.lotId)) throw new Error("Ingresso inválido.");
  const maxQuantity = input.eventSlug === SOROCABA_EVENT_SLUG ? 20 : 10;
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > maxQuantity) {
    throw new Error("Quantidade inválida.");
  }
  const url = new URL(`/evento/${input.eventSlug}/checkout`, "https://www.tcringressos.app.br");
  url.searchParams.set("lotId", input.lotId);
  url.searchParams.set(`quantity_${input.lotId}`, String(input.quantity));
  if (input.lotOptionId) {
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.lotOptionId)) throw new Error("Opção de ingresso inválida.");
    url.searchParams.set(`lotOption_${input.lotId}`, input.lotOptionId);
  }
  url.searchParams.set("utm_source", "whatsapp");
  const paidAd = input.paidAd ?? Boolean(input.adId);
  url.searchParams.set("utm_medium", paidAd ? "meta_ads" : "organic");
  if (paidAd) url.searchParams.set("utm_term", "verified_meta_referral");
  url.searchParams.set("utm_campaign", input.eventSlug === "rodrigo-teaser-em-sorocaba-2026" ? "rodrigo_sorocaba_whatsapp" : "geriatricus_whatsapp_piloto");
  if (input.adId && /^\d{1,30}$/.test(input.adId)) url.searchParams.set("utm_content", input.adId);
  url.hash = "resumo";
  return url.toString();
}
