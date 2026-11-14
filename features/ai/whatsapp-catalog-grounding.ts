type Decision = { outcome: "AUTO_REPLY" | "HANDOFF" | "SILENT"; reply: string; reason: string; topic: string };
type Event = { id: string; title: string; city: string; url: string; tickets: Array<{ name: string; basePrice: string; serviceFee: string; availableUnits: number }> };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const contains = (text: string, phrase: string) => phrase.length > 2 && ` ${text} `.includes(` ${phrase} `);

// Only customer statements establish event identity. Previous model answers are not evidence.
export function selectSupportEvent<T extends Event>(message: string, conversation: Array<{ direction: string; text: string }>, events: T[]): T | null {
  const statements = [message, ...conversation.filter(row => row.direction === "customer").map(row => row.text).reverse()];
  for (const statement of statements) {
    const text = normalize(statement);
    const full = events.filter(event => contains(text, normalize(event.title)) || statement.includes(event.url));
    if (full.length) return full.length === 1 ? full[0] : null;
    const cities = events.filter(event => contains(text, normalize(event.city)));
    if (!cities.length) continue;
    if (cities.length === 1) return cities[0];
    const artistMatches = cities.filter(event => {
      const artist = normalize(event.title).split(/ em | na | no /)[0];
      return contains(text, artist);
    });
    return artistMatches.length === 1 ? artistMatches[0] : null;
  }
  return null;
}

export function guardSupportCatalog(input: { decision: Decision; event: Event | null; customerMessage: string; hasOrders: boolean }): Decision {
  const { decision, event } = input;
  if (decision.outcome !== "AUTO_REPLY") return decision;
  const answer = normalize(decision.reply);
  const question = normalize(input.customerMessage);
  const quotedMoney = /R\$\s*[\d.,]+/.test(decision.reply);
  const catalogQuestion = /\b(ingressos?|setores?|precos?|valores?|black|disponibilidade|lugares|economica|economico)\b/.test(question);
  const sectors = ["pista", "cadeira", "prata", "ouro", "bronze", "premium", "primeira fileira", "camarote", "mezanino", "arquibancada", "mesa"];
  const mentioned = sectors.filter(sector => new RegExp(`(?:^| )${sector}s?(?: |$)`).test(answer));
  if (!event) {
    if (!(quotedMoney || mentioned.length)) return decision;
    return { outcome: "AUTO_REPLY", topic: "identificar_evento", reason: "Catálogo exige evento inequívoco informado pelo cliente.", reply: "Pode confirmar o nome do artista ou evento e a cidade? Assim consulto os ingressos e valores corretos para você." };
  }
  const published = event.tickets.filter(ticket => ticket.availableUnits > 0);
  const names = normalize(published.map(ticket => ticket.name).join(" "));
  const unknownSector = mentioned.some(sector => !contains(names, sector));
  // Price answers for new purchases are rendered from the catalog, never copied from model prose.
  if (!unknownSector && !(quotedMoney && (catalogQuestion || !input.hasOrders))) return decision;
  const rows = published.slice(0, 12).map(ticket => `• ${ticket.name}: ${ticket.basePrice} + ${ticket.serviceFee} de taxa por unidade.`);
  return {
    outcome: "AUTO_REPLY", topic: "catalogo_verificado", reason: "Resposta comercial conferida com o catálogo do evento selecionado.",
    reply: [`Ingressos disponíveis para ${event.title}:`, ...rows,
      published.length ? "Valores por unidade. Meia-entrada exige comprovação do benefício. Consulte as condições de cada ingresso no site." : "Não encontrei ingressos disponíveis neste momento.",
      event.url].join("\n")
  };
}
