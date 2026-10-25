import { beforeEach, describe, expect, it, vi } from "vitest";

const logs: Array<{ payload: Record<string, unknown> }> = [];
const lists: Array<{ text: string; rows: Array<{ id: string; title: string; description?: string }>; metadata: Record<string, unknown> }> = [];
const buttons: Array<{ text: string; url: string; metadata: Record<string, unknown> }> = [];
const media: Array<{ kind: string; mediaUrl: string; caption: string; metadata: Record<string, unknown> }> = [];
const sendOrder: string[] = [];
let phoneSessionAvailable = true;

const lot = (id: string, name: string, priceInCents: number, options: string[] = []) => ({
  id, name, description: name.includes("SOLIDÁRIO")
    ? "Setor com cadeiras, atrás da Cadeira Ouro. Levar 1 kg de alimento não perecível para doação; não serão aceitos sal, açúcar, farinha ou fubá."
    : name.includes("MEIA ENTRADA")
      ? "Setor com cadeiras, atrás da Cadeira Ouro. Necessário comprovar o direito à meia-entrada."
      : null,
  priceInCents, status: "ACTIVE", saleBadge: "NONE", totalQuantity: options.length || 100,
  reservedQuantity: 0, soldQuantity: 0, minPerOrder: 1, maxPerOrder: 10,
  admissionsPerUnit: name.includes("MESA") ? 4 : 1, salesStartsAt: null, salesEndsAt: null,
  hasTypeOptions: options.length > 0,
  typeOptions: options.map((label, index) => ({ id: `option-${index + 1}-12345678`, label, status: "ACTIVE", soldQuantity: 0, reservedQuantity: 0 }))
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn(async () => ({
      id: "event-sorocaba", title: "Rodrigo Teaser em Sorocaba", startsAt: new Date("2026-12-01T00:00:00Z"),
      venueName: "Clube Recreativo de Sorocaba", venueAddress: "Rua Francisco Paulo Braion, 650",
      eventMapImageUrl: "https://www.phsis.com.br/files/20/image/20261024082407.png",
      salesStartsAt: null, salesEndsAt: null,
      lots: [
        lot("lot-prata-meia-123", "CADEIRA PRATA - MEIA ENTRADA", 14790),
        lot("lot-prata-solidario-123", "CADEIRA PRATA - SOLIDÁRIO", 15790),
        lot("lot-ouro-meia-123", "CADEIRA OURO - MEIA ENTRADA", 17790),
        lot("lot-primeira-123", "PRIMEIRA FILEIRA - EXCLUSIVO", 59790),
        lot("lot-mesa-12345678", "MESA PARA 04 PESSOAS", 119790,
          Array.from({ length: 15 }, (_, index) => `MESA ${index + 16}`))
      ]
    })) },
    whatsAppMessageLog: {
      findMany: vi.fn(async () => phoneSessionAvailable ? [...logs].reverse() : []),
      findFirst: vi.fn(async ({ where }: { where: { providerMessageId?: string } }) =>
        where.providerMessageId === "sent-intro-message" ? logs[0] : null)
    }
  }
}));

vi.mock("@/features/whatsapp/whatsapp.service", () => ({
  sendWhatsAppTextMessage: vi.fn(async (input: { text: string; source: string; metadata: Record<string, unknown> }) => {
    logs.push({ payload: { source: input.source, ...input.metadata } });
  }),
  sendWhatsAppListMessage: vi.fn(async (input: { text: string; rows: Array<{ id: string; title: string; description?: string }>; source: string; metadata: Record<string, unknown> }) => {
    sendOrder.push("list");
    lists.push(input);
    logs.push({ payload: { source: input.source, ...input.metadata } });
  }),
  sendWhatsAppUrlButtonMessage: vi.fn(async (input: { text: string; url: string; source: string; metadata: Record<string, unknown> }) => {
    buttons.push(input);
    logs.push({ payload: { source: input.source, ...input.metadata } });
  }),
  sendWhatsAppMediaMessage: vi.fn(async (input: { kind: string; mediaUrl: string; caption: string; metadata: Record<string, unknown> }) => {
    sendOrder.push("map");
    media.push(input);
    logs.push({ payload: { ...input.metadata } });
  })
}));

import { processSorocabaSalesJourney } from "@/features/whatsapp/sorocaba-sales-journey";

const base = { organizationId: "tcr", phone: "5521984456499" };
const greeting = "Olá, vim pelo anúncio do Rodrigo Teaser em Sorocaba e tenho interesse no evento";

beforeEach(() => { logs.length = 0; lists.length = 0; buttons.length = 0; media.length = 0; sendOrder.length = 0; phoneSessionAvailable = true; });

describe("fluxo completo de Sorocaba sem envio real", () => {
  it("inicia o mesmo menu de vendas com a palavra-chave Sorocaba", async () => {
    expect(await processSorocabaSalesJourney({ ...base, text: "Sorocaba" })).toBe(true);
    expect(lists[0].text).toContain("*Rodrigo Teaser em Sorocaba*");
  });
  it("inicia o menu interativo quando o cliente escreve Rodrigo Tizer em Sorocaba", async () => {
    expect(await processSorocabaSalesJourney({ ...base, text: "Rodrigo Tizer em Sorocaba" })).toBe(true);
    expect(lists[0].text).toContain("*Rodrigo Teaser em Sorocaba*");
    expect(lists[0].rows.some((row) => row.title.includes("Tipos de ingresso"))).toBe(true);
  });
  it("preserva a origem comprovada do anúncio durante a conversa", async () => {
    await processSorocabaSalesJourney({ ...base, text: greeting, origin: { kind: "meta_ad", adId: "123456" } });
    await processSorocabaSalesJourney({ ...base, text: "🎟️ Tipos de ingresso" });
    await processSorocabaSalesJourney({ ...base, text: "🟢 Primeira Fileira" });
    const quantityPage = new URL(buttons[0].url);
    expect(quantityPage.searchParams.get("paidAd")).toBe("1");
    expect(quantityPage.searchParams.get("adId")).toBe("123456");
  });
  it("abre o seletor de quantidade da Primeira Fileira direto ao escolher o setor", async () => {
    await processSorocabaSalesJourney({ ...base, text: greeting });
    await processSorocabaSalesJourney({ ...base, text: "🎟️ Tipos de ingresso" });
    expect(await processSorocabaSalesJourney({ ...base, text: "🟢 Primeira Fileira" })).toBe(true);
    expect(lists).toHaveLength(2);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text).toContain("PRIMEIRA FILEIRA - EXCLUSIVO");
    expect(buttons[0].text).toContain("1 a 20 ingressos");
    expect(buttons[0].url).toContain("/evento/rodrigo-teaser-em-sorocaba-2026/quantidade?lotId=lot-primeira-123");
  });
  it("mantém Sorocaba ao tocar na opção mesmo sem localizar a sessão pelo telefone", async () => {
    await processSorocabaSalesJourney({ ...base, text: greeting });
    phoneSessionAvailable = false;
    expect(await processSorocabaSalesJourney({ ...base, text: "🎟️ Tipos de ingresso", replyToMessageId: "sent-intro-message" })).toBe(true);
    expect(media).toHaveLength(1);
    expect(lists.at(-1)?.rows[0].title).toBe("⚪ Cadeira Prata");
  });
  it("abre o menu, mostra os preços da Prata separados e leva a meia-entrada ao checkout", async () => {
    expect(await processSorocabaSalesJourney({ ...base, text: greeting })).toBe(true);
    expect(lists[0].text).toContain("*Rodrigo Teaser em Sorocaba*");
    expect(lists[0].text).toContain("*Como posso ajudar?*");
    expect(lists[0].rows).toHaveLength(1);
    expect(lists[0].rows[0].title).toBe("🎟️ Tipos de ingresso");
    expect(media).toHaveLength(0);

    expect(await processSorocabaSalesJourney({ ...base, text: "🎟️ Tipos de ingresso" })).toBe(true);
    expect(media).toHaveLength(1);
    expect(media[0].mediaUrl).toContain("20261024082407.png");
    expect(sendOrder.slice(0, 3)).toEqual(["list", "map", "list"]);
    expect(lists[1].rows).toHaveLength(5);
    expect(lists[1].text).toContain("*Agora escolha a opção que mais combina com você.*");

    expect(await processSorocabaSalesJourney({ ...base, text: "⚪ Cadeira Prata" })).toBe(true);
    expect(lists[2].text).toContain("*CADEIRA PRATA - MEIA ENTRADA*\nR$ 147,90 + taxas");
    expect(lists[2].text).toContain("*CADEIRA PRATA - SOLIDÁRIO*\nR$ 157,90 + taxas");
    expect(lists[2].text).toContain("Levar 1 kg de alimento não perecível");
    expect(lists[2].text).toContain("Necessário comprovar o direito à meia-entrada");
    expect(lists[2].text).not.toContain("CADEIRA OURO");
    expect(lists[2].rows).toHaveLength(2);
    expect(lists[2].text.length).toBeLessThanOrEqual(1024);
    expect(lists[2].rows.map((row) => row.title)).toEqual(["Prata · Meia-entrada", "Prata · Solidário"]);
    expect(lists[2].rows[1].description).toContain("1 kg de alimento");
    expect(lists[2].rows.every((row) => row.title.length <= 24 && (row.description?.length || 0) <= 72)).toBe(true);

    expect(await processSorocabaSalesJourney({ ...base, text: lists[2].rows[0].title })).toBe(true);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text).toContain("Necessário comprovar o direito à meia-entrada");
    expect(buttons[0].text).toContain("Escolha de *1 a 20 ingressos*");
    expect(buttons[0].metadata.step).toBe("done");
    const quantityPage = new URL(buttons[0].url);
    expect(quantityPage.pathname).toBe("/evento/rodrigo-teaser-em-sorocaba-2026/quantidade");
    expect(quantityPage.searchParams.get("lotId")).toBe("lot-prata-meia-123");
  });

  it("pagina as 15 mesas e preserva o número escolhido no checkout", async () => {
    await processSorocabaSalesJourney({ ...base, text: greeting });
    await processSorocabaSalesJourney({ ...base, text: "🎟️ Tipos de ingresso" });
    expect(await processSorocabaSalesJourney({ ...base, text: "🟠 Mesas" })).toBe(true);
    expect(await processSorocabaSalesJourney({ ...base, text: "MESA PARA 04 PESSOAS" })).toBe(true);
    expect(lists.at(-1)?.rows).toHaveLength(10);
    expect(lists.at(-1)?.rows.at(-1)?.title).toBe("Ver mais números");
    expect(await processSorocabaSalesJourney({ ...base, text: "Ver mais números" })).toBe(true);
    expect(lists.at(-1)?.rows[0].title).toBe("MESA 25");
    expect(await processSorocabaSalesJourney({ ...base, text: "MESA 30" })).toBe(true);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text).toContain("*Sua escolha:* MESA 30");
    const checkout = new URL(buttons[0].url);
    expect(checkout.searchParams.get("lotOption_lot-mesa-12345678")).toBe("option-15-12345678");
  });

  it("deixa uma pergunta livre para a IA e permite voltar ao menu", async () => {
    await processSorocabaSalesJourney({ ...base, text: greeting });
    await processSorocabaSalesJourney({ ...base, text: "🎟️ Tipos de ingresso" });
    expect(await processSorocabaSalesJourney({ ...base, text: "Tem estacionamento?" })).toBe(false);
    expect(await processSorocabaSalesJourney({ ...base, text: "menu" })).toBe(true);
    expect(lists).toHaveLength(3);
  });
});
