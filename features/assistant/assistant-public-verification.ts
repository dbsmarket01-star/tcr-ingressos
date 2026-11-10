import { prisma } from "@/lib/prisma";
import { orderTicketLots } from "@/features/lots/lot-order";
import { getPublicEventUrl } from "@/lib/public-url";
import { cleanSourceText } from "./assistant-event-import";
import { fetchPublicEventHtml } from "./public-event-source";

export function publicTicketNames(html: string) {
  const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return [...body.matchAll(/<strong\b[^>]*class=["'][^"']*\bticketPickerTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/strong>/gi)].map(match => cleanSourceText(match[1]));
}
/** Verify the actual public surface after a committed change; failures never trigger another mutation. */
export async function verifyAssistantPublicTickets(organizationId: string, eventId: string) {
  try {
  const event = await prisma.event.findFirstOrThrow({ where: { id: eventId, organizationId }, select: {
    slug: true, status: true, organization: { select: { publicDomain: true } },
    lots: { where: { status: { in: ["ACTIVE", "SOLD_OUT"] } }, select: { id: true, name: true, sortOrder: true, createdAt: true, priceInCents: true } }
  } });
  const url = getPublicEventUrl(event.slug, event.organization).replace(/^https:\/\/tcringressos\.app\.br\//, "https://www.tcringressos.app.br/");
  if (event.status !== "PUBLISHED") return { ok: true, detail: `Evento ${event.status}: permanece fora da venda pública.`, url };
    const response = await fetchPublicEventHtml(url);
    const expected = orderTicketLots(event.lots).map(lot => lot.name);
    const actual = publicTicketNames(response.html);
    const text = cleanSourceText(response.html);
    const pricesMatch = event.lots.every(lot => text.includes((lot.priceInCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })));
    const ok = response.status === 200 && JSON.stringify(actual) === JSON.stringify(expected) && pricesMatch;
    return { ok, detail: ok ? `Página pública HTTP 200: ${actual.length} ingressos, preços e sequência conferidos.` : `Alteração salva no banco; conferência pública pendente (HTTP ${response.status}). Não repita a operação.`, url };
  } catch { return { ok: false, detail: "Alteração salva no banco; página pública indisponível para conferência. Não repita a operação.", url: "" }; }
}
