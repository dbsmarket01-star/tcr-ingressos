import { prisma } from "../lib/prisma";
import { createTicketLot } from "../features/lots/lot.service";

// One-time, idempotent catalog sync for the categories explicitly authorized on 2026-11-06.
const pairs = [
  ["fernandinho-santo-andre-2026", "ovnlwqeQ1nTrEpwwYgt5h6i%2AEvnxKhLJ88wGE9_HqmQ%3A"],
  ["geriatricus-em-santo-andre-2026", "0hwVgLowlRH4438I_oGnKbailkaEyKOxd%2AEACpYKgF8%3A"],
  ["geriatricus-em-suzano-2026", "0hwVgLowlRH4438I_oGnKZLEC6tPpb7kqlfiHApapos%3A"],
  ["rodrigo-teaser-em-marilia-2026", "0hwVgLowlRH4438I_oGnKTZEwjTa0AyjtvEsx%2Ae1wLM%3A"],
  ["rodrigo-teaser-em-taubate-2026", "0hwVgLowlRH4438I_oGnKfY465tNWRwtAKdF1oWg0Ws%3A"],
  ["rodrigo-teaser-em-piracicaba-2026", "0hwVgLowlRH4438I_oGnKW3NmayPU%2A_n2sR605GN9ec%3A"],
  ["rodrigo-teaser-em-sao-caetano-do-sul-2026", "0hwVgLowlRH4438I_oGnKSUWYslKqBDWMG1436FUqW4%3A"],
  ["rodrigo-teaser-em-sorocaba-2026", "0hwVgLowlRH4438I_oGnKWBPB%2AkK2lPQn97fBv8Zo6c%3A"],
  ["guilherme-arantes-sao-caetano-do-sul", "HDyXwCcXvS6DhuU9I9s_yioj9%2AwLDONhafKRx59oVGk%3A"]
] as const;

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function sector(value: string) {
  const n = norm(value);
  if (n.includes("PREMIUM")) return "PREMIUM";
  if (n.includes("BRONZE")) return "BRONZE";
  if (n.includes("PRATA")) return "PRATA";
  if (n.includes("OURO")) return "OURO";
  if (n.includes("MEZANINO")) return "MEZANINO";
  if (n.includes("PISTA")) return "PISTA";
  if (n.includes("CADEIRA")) return "CADEIRA";
  return "";
}

async function legacyTickets(path: string) {
  const base = new URL(path, "https://tcringressos.com.br/");
  const page = await (await fetch(base, { cache: "no-store" })).text();
  const href = page.match(/<a class="text-black" href="([^"]+)">/)?.[1];
  if (!href) throw new Error(`Compra não encontrada: ${base}`);
  const purchase = await (await fetch(new URL(href, base), { cache: "no-store" })).text();
  const rows = [...purchase.matchAll(/<div class="imput-result clean text-black text-bold">([^<]+)<\/div>[\s\S]*?<div class="imput-result clean text-black text-bold">R\$\s*([\d.,]+)<\/div>[\s\S]*?<input[^>]*class="ticket-amount-field"[^>]*data-max="(\d+)"/g)];
  if (rows.length < 3) throw new Error(`Lista legada incompleta: ${base}`);
  return rows.map(row => ({ name: row[1].trim(), priceInCents: Math.round(Number(row[2].replace(/\./g, "").replace(",", ".")) * 100) }))
    .filter(row => /(?:BLACK NOVEMBER|INTEIRA)/i.test(row.name));
}

async function main() {
  const plan = [];
  for (const [slug, path] of pairs) {
    const event = await prisma.event.findFirstOrThrow({ where: { slug }, include: { lots: true } });
    const source = await legacyTickets(path);
    for (const row of source) {
      const s = slug === "rodrigo-teaser-em-sao-caetano-do-sul-2026" && norm(row.name).startsWith("CADEIRA PRATA")
        ? "CADEIRA" : sector(row.name);
      if (event.lots.some(lot => norm(lot.name) === norm(row.name))) continue;
      const base = event.lots.find(lot => lot.status === "ACTIVE" && sector(lot.name) === s && lot.name.includes("MEIA"))
        ?? event.lots.find(lot => lot.status === "ACTIVE" && sector(lot.name) === s && lot.name.includes("SOLIDÁRIO"));
      if (!base) throw new Error(`Sem lote-base ativo para ${slug} / ${row.name}`);
      const prefix = base.name.replace(/\s*-\s*(?:MEIA ENTRADA|SOLIDÁRIO).*$/iu, "").trim();
      const suffix = /BLACK NOVEMBER/i.test(row.name) ? "BLACK NOVEMBER" : "INTEIRA";
      const name = `${prefix} - ${suffix}`;
      if (event.lots.some(lot => norm(lot.name) === norm(name))) continue;
      plan.push({ slug, eventId: event.id, name, priceInCents: row.priceInCents, base });
    }
  }
  console.log(JSON.stringify(plan.map(({ slug, name, priceInCents }) => ({ slug, name, priceInCents })), null, 2));
  if (process.env.APPLY_LEGACY_PROMO_LOTS !== "1") return;
  for (const item of plan) {
    const exists = await prisma.ticketLot.findFirst({ where: { eventId: item.eventId, name: item.name } });
    if (exists) continue;
    const b = item.base;
    const created = await createTicketLot({
      eventId: item.eventId, name: item.name,
      description: /BLACK NOVEMBER/.test(item.name) ? "Ingresso promocional Black November. Consulte as regras do evento." : "Ingresso inteiro para o setor indicado.",
      highlightColor: b.highlightColor ?? "", saleBadge: "NONE", descriptionAsList: false,
      hasHotel: false, churchQuestionEnabled: false, hasTypeOptions: false,
      admissionsPerUnit: 1, priceInCents: item.priceInCents,
      serviceFeeBps: b.serviceFeeBps, pixDiscountPercentBps: b.pixDiscountPercentBps,
      pixDiscountFixedInCents: b.pixDiscountFixedInCents,
      cardInterestBpsPerInstallment: b.cardInterestBpsPerInstallment,
      cardInterestStartsAtInstallment: b.cardInterestStartsAtInstallment,
      totalQuantity: 1000, minPerOrder: 1, maxPerOrder: b.maxPerOrder,
      status: "ACTIVE"
    });
    console.log(`CREATED ${item.slug} ${created.name} ${created.id}`);
  }
}

main().finally(() => prisma.$disconnect());
