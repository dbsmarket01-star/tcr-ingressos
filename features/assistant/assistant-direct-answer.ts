type TicketEvent = {
  id: string;
  title: string;
  city: string;
  lots: Array<{ name: string; priceInCents: number; status: string }>;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function answerReadOnlyTicketQuestion(
  question: string,
  ranked: Array<{ event: { id: string; title: string }; score: number }>,
  details: TicketEvent[]
): string | null {
  const query = normalize(question);
  if (!/\b(ingresso|lote|setor|categoria|preco|valor)\b/.test(query)) return null;
  if (!ranked.length) return "Vou apenas consultar, sem alterar nada. Informe o nome do evento e a cidade para eu localizar os ingressos corretos.";
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return `Vou apenas consultar, sem alterar nada. Encontrei mais de um evento possível: ${ranked.filter((item) => item.score === ranked[0].score).map((item) => item.event.title).join("; ")}. Qual deles você quer?`;
  }
  const event = details.find((item) => item.id === ranked[0].event.id);
  if (!event) return null;
  const terms = ["ouro", "prata", "bronze", "meia", "solidario", "inteira", "primeira", "fileira", "pista", "mesa", "camarote"].filter((term) => query.includes(term));
  const lots = event.lots.filter((lot) => lot.status === "ACTIVE" && terms.every((term) => normalize(lot.name).includes(term)));
  if (!lots.length) return `Consultei ${event.title}, sem alterar nada. Não encontrei ingresso ativo${terms.length ? ` para “${terms.join(" ")}”` : ""} nesse evento.`;
  const displayed = lots.slice(0, 30).map((lot) => `• ${lot.name}: ${(lot.priceInCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} + taxas`);
  return `Consultei ${event.title}, sem alterar nada. ${terms.length ? "Encontrei:" : "Ingressos ativos:"}\n${displayed.join("\n")}${lots.length > displayed.length ? `\nE mais ${lots.length - displayed.length} categorias.` : ""}`;
}
