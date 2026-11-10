type TicketEvent = {
  id: string;
  title: string;
  city: string;
  lots: Array<{ name: string; priceInCents: number; status: string }>;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatPrice(priceInCents: number) {
  return (priceInCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function answerReadOnlyTicketQuestion(
  question: string,
  ranked: Array<{ event: { id: string; title: string }; score: number }>,
  details: TicketEvent[]
): string | null {
  const query = normalize(question);
  // Code-investigation requests must reach the model's repository tools. A
  // mention of "ingressos" in that request is not a ticket-price question.
  if (/\b(codigo|repositorio|arquivo|arquivos|implementa|implementacao|funcao|componente|fonte)\b/.test(query)) return null;
  if (!/\b(ingressos?|lotes?|setores?|categorias?|precos?|valores?)\b/.test(query)) return null;
  if (!ranked.length) return "Vou apenas consultar, sem alterar nada. Informe o nome do evento e a cidade para eu localizar os ingressos corretos.";
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return `Vou apenas consultar, sem alterar nada. Encontrei mais de um evento possível: ${ranked.filter((item) => item.score === ranked[0].score).map((item) => item.event.title).join("; ")}. Qual deles você quer?`;
  }
  const event = details.find((item) => item.id === ranked[0].event.id);
  if (!event) return null;
  // An order audit names several sectors in the same sentence. Those words are
  // examples, not an AND-filter for a single ticket name.
  if (/\b(ordem|ordenacao|sequencia)\b/.test(query) && /\b(ingressos?|lotes?|setores?|categorias?)\b/.test(query)) {
    const visible = event.lots.filter((lot) => lot.status === "ACTIVE" || lot.status === "SOLD_OUT");
    const paused = event.lots.filter((lot) => lot.status === "PAUSED");
    const lines = visible.map((lot, index) => `${index + 1}. ${lot.name} — ${formatPrice(lot.priceInCents)}${lot.status === "SOLD_OUT" ? " (esgotado)" : ""}`);
    const pausedLines = paused.map((lot) => `• ${lot.name} — ${formatPrice(lot.priceInCents)} (pausado)`);
    return `Consultei ${event.title}, sem alterar nada. Ordem atual dos ingressos visíveis:\n${lines.join("\n") || "Nenhum ingresso visível."}\nIngressos pausados (fora da ordem pública):\n${pausedLines.join("\n") || "Nenhum."}`;
  }
  const terms = ["ouro", "prata", "bronze", "meia", "solidario", "inteira", "primeira", "fileira", "pista", "mesa", "camarote"].filter((term) => query.includes(term));
  const lots = event.lots.filter((lot) => lot.status === "ACTIVE" && terms.every((term) => normalize(lot.name).includes(term)));
  if (!lots.length) return `Consultei ${event.title}, sem alterar nada. Não encontrei ingresso ativo${terms.length ? ` para “${terms.join(" ")}”` : ""} nesse evento.`;
  const displayed = lots.slice(0, 30).map((lot) => `• ${lot.name}: ${formatPrice(lot.priceInCents)} + taxas`);
  return `Consultei ${event.title}, sem alterar nada. ${terms.length ? "Encontrei:" : "Ingressos ativos:"}\n${displayed.join("\n")}${lots.length > displayed.length ? `\nE mais ${lots.length - displayed.length} categorias.` : ""}`;
}
