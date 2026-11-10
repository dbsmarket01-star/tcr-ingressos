import { orderTicketLots } from "@/features/lots/lot-order";
import { sectorFromLotName } from "@/features/reports/event-sector-report";

type Lot = { id: string; name: string; priceInCents: number; sortOrder: number; status: string };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isTicketOrderRequest(message: string) {
  const text = normalize(message);
  const ordering = /\b(ordenar|ordene|organizar|organize|ordem|sequencia|reordene|reordenar)\b/.test(text);
  const moving = /\b(mova|mover|coloque|colocar|posicione|posicionar|suba|desca)\b/.test(text) && /\b(antes|depois|acima|abaixo|cima|baixo)\b/.test(text);
  return (ordering || moving) && /\b(ingressos?|lotes?|setores?|meia|inteira|november|fileira|camarotes?|mesas?|ouro|prata|bronze|pista|premium|cadeira)\b/.test(text);
}

/** Keep the event's sector sequence; within each sector sort by price, then category. */
export function proposedTicketOrder<T extends Lot>(lots: T[]): T[] {
  const visible = orderTicketLots(lots.filter((lot) => lot.status === "ACTIVE" || lot.status === "SOLD_OUT"));
  const groups = new Map<string, T[]>();
  for (const lot of visible) {
    const sector = normalize(sectorFromLotName(lot.name));
    groups.set(sector, [...(groups.get(sector) || []), lot]);
  }
  const rank = (name: string) => {
    const value = normalize(name);
    if (/\bmeia(?:\s+entrada)?\b/.test(value)) return 0;
    if (/\bblack\s+november\b/.test(value)) return 1;
    if (/\binteira\b/.test(value)) return 2;
    return 3;
  };
  return [...groups.values()].flatMap((group) => [...group].sort((a, b) =>
    a.priceInCents - b.priceInCents || rank(a.name) - rank(b.name) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
}

/** Resolve explicit moves against actual visible sectors, never guessed sector names. */
export function resolveTicketOrder<T extends Lot>(lots: T[], message: string): { lots: T[]; explanation: string; error?: string } {
  const visible = orderTicketLots(lots.filter(lot => lot.status === "ACTIVE" || lot.status === "SOLD_OUT"));
  const groups = new Map<string, T[]>();
  for (const lot of visible) {
    const key = normalize(sectorFromLotName(lot.name)).replace(/\s+/g, " ").trim();
    groups.set(key, [...(groups.get(key) || []), lot]);
  }
  const keys = [...groups.keys()];
  const clean = (text: string) => normalize(text).replace(/[^a-z0-9]+/g, " ").trim();
  const text = clean(message);
  const fail = (detail: string) => ({ lots: visible, explanation: "", error: `${detail} Setores disponíveis: ${keys.join("; ")}. Informe qual setor mover e antes/depois de qual setor.` });
  const matches = (part: string) => {
    const hits = keys.map(key => {
      const aliases = [key, key.replace(/^setor /, ""), ...groups.get(key)!.map(lot => clean(lot.name))];
      return { key, length: Math.max(0, ...aliases.filter(alias => (` ${part} `).includes(` ${alias} `)).map(alias => alias.length)) };
    }).filter(hit => hit.length > 0).sort((a,b) => b.length-a.length);
    // A generic CAMAROTE match must not override the more precise CAMAROTE 18.
    const best = hits.filter(hit => hit.length === hits[0]?.length).map(hit => hit.key);
    if (best.length === 1 && best[0] === "camarote" && hits[0].length === "camarote".length) {
      return keys.filter(key => /\bcamarote\b/.test(key));
    }
    return best;
  };
  const relative = text.match(/\b(antes|depois|acima|abaixo)\s+(?:(?:de|do|da|dos|das)\s+)?(.+)$/);
  const direction = text.match(/\b(?:para|pra)\s+(cima|baixo)\b/);
  const move = /\b(mova|mover|coloque|colocar|posicione|posicionar|leve|suba|desca|reposicione|reordenar|reordene)\b/.test(text);
  if (!relative && !direction) {
    if (move) return fail("Não identifiquei uma posição inequívoca.");
    return { lots: proposedTicketOrder(lots), explanation: "Manter a sequência dos setores e ordenar as categorias por preço, com a prioridade aprovada nos empates." };
  }
  const divider = relative?.index ?? direction!.index!;
  const subjects = matches(text.slice(0, divider));
  if (subjects.length !== 1) return fail("Não identifiquei um único setor de origem.");
  const subject = subjects[0];
  const from = keys.indexOf(subject);
  let to: number;
  if (relative) {
    const allBoxes = /\b(?:todos os |os )?camarotes\b/.test(relative[2]);
    const targets = allBoxes ? keys.filter(key => /\bcamarote\b/.test(key) && key !== subject) : matches(relative[2]);
    if (!targets.length || (!allBoxes && targets.length !== 1) || targets.includes(subject)) return fail("O destino é ausente, ambíguo ou igual à origem.");
    const after = relative[1] === "depois" || relative[1] === "abaixo";
    const remaining = keys.filter(key => key !== subject);
    const targetIndexes = targets.map(key => remaining.indexOf(key));
    to = after ? Math.max(...targetIndexes) + 1 : Math.min(...targetIndexes);
  } else {
    to = Math.max(0, Math.min(keys.length - 1, from + (direction![1] === "cima" ? -1 : 1)));
  }
  const reordered = keys.filter(key => key !== subject); reordered.splice(to, 0, subject);
  return { lots: reordered.flatMap(key => groups.get(key)!), explanation: `Mover o setor ${subject.toLocaleUpperCase("pt-BR")} inteiro, preservando as categorias e os demais setores. Sequência: ${reordered.join(" → ")}.` };
}
