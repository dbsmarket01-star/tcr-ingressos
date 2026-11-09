function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isPauseSolidarityRequest(message: string) {
  const text = normalize(message);
  return /\b(pausar|pause|desativar|desative|suspender|suspenda|tira|tire|retira|retire|remova|remove)\b/.test(text)
    && /\bsolidari(?:o|os|a|as)\b/.test(text);
}

export function activeSolidarityLots<T extends { name: string; status: string }>(lots: T[]): T[] {
  return lots.filter((lot) => lot.status === "ACTIVE" && /\bsolidari(?:o|os|a|as)\b/.test(normalize(lot.name)));
}
