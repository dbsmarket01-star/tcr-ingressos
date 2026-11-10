function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isReadOnlyAssistantRequest(message: string) {
  const request = normalize(message).trim()
    .replace(/(?:nao\s+(?:altere|mude|modifique|salve|grave|execute)(?:\s+nada|\s+alteracoes)?|sem\s+(?:alterar|mudar|salvar|gravar|executar)(?:\s+nada|\s+alteracoes)?)\s+(?:antes\s+(?:de\s+)?(?:eu\s+)?confirmar|ate\s+(?:eu\s+)?confirmar|sem\s+(?:minha\s+)?confirmacao)/g, "")
    .replace(/se ja estiverem corretos,?\s*nao grave nada/g, "");
  if (/^(?:por favor[, ]+)?nao\b/.test(request)) return true;
  if (/\b(?:nao (?:altere|mude|modifique|grave|salve) nada|(?:so|apenas|somente) (?:analise|consulte|consulta|investigue))\b/.test(request)) return true;
  // A restriction on other fields must not cancel an explicit change request.
  const actionPrefix = /^(?:(?:chat|assistente)[,!\s]+)?(?:(?:por favor|pode|voce pode|quero que voce|eu quero que voce|preciso que voce|eu preciso que voce|me ajude a)[,\s]+)*(?:retire|tire|pause|despublique|publique|reative|deixe|altere|mude|modifique|aumente|reduza|organize|organizar|ordene|ordenar|reordene|reordenar|corrija|corrigir|ajuste|ajustar|coloque|colocar|crie|criar|adicione|adicionar)\b/;
  if (actionPrefix.test(request)) return false;
  return /\b(nao\s+(?:altere|mude|modifique|faca\s+alteracoes|organize|ordene|reordene|corrija|ajuste|crie|adicione|grave)|sem\s+(?:alterar|mudar|modificar|gravar)|(?:so|apenas|somente)\s+(?:consulte|consultar|consulta|informe|informar))\b/.test(request);
}

export function assistantAcknowledgement(message: string) {
  return isReadOnlyAssistantRequest(message)
    ? "Entendi. Vou conferir os dados e não farei nenhuma alteração."
    : "Entendi. Vou conferir os dados. Se houver alguma mudança, mostrarei a proposta para sua confirmação antes de salvar.";
}

/** A print used as evidence is not an instruction to replace event artwork. */
export function requestedAssistantImageField(message: string): "bannerUrl" | "eventMapImageUrl" | null {
  const text = normalize(message);
  const banner = /\bbanner\b|\bcapa\b|\barte\b/.test(text);
  const map = /\bmapa\b/.test(text);
  if (banner === map) return null;
  const replace = /\b(troque|trocar|substitua|substituir|altere|alterar|atualize|atualizar|coloque|colocar|aplique|aplicar)\b/.test(text);
  const useAsArtwork = /\b(?:use|usar)\b.*\b(?:como|para|no|na)\b.*\b(?:banner|capa|arte|mapa)\b/.test(text) && !/\breferencia\b/.test(text);
  return replace || useAsArtwork ? (banner ? "bannerUrl" : "eventMapImageUrl") : null;
}
export function assistantSourceRequest(message: string, history: Array<{ role: string; text: string }>): string {
  if (/https?:\/\//i.test(message)) return message;
  if (!/\b(?:(?:link|referencia|pagina|site)\s+(?:antig[oa]|anterior)|mesm[oa]\s+(?:link|referencia|pagina)|(?:nesse|desse)\s+link)\b/.test(normalize(message))) return message;
  const previous = [...history].reverse().find((item) => item.role === "user" && /https?:\/\//i.test(item.text));
  const url = previous?.text.match(/https?:\/\/[^\s<>]+/i)?.[0];
  return url ? `${message}\nReferência anterior: ${url}` : message;
}
