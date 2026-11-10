function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isReadOnlyAssistantRequest(message: string) {
  const request = normalize(message).trim()
    .replace(/(?:nao\s+(?:altere|mude|modifique|salve|grave|execute)(?:\s+nada|\s+alteracoes)?|sem\s+(?:alterar|mudar|salvar|gravar|executar)(?:\s+nada|\s+alteracoes)?)\s+(?:antes\s+(?:de\s+)?(?:eu\s+)?confirmar|ate\s+(?:eu\s+)?confirmar|sem\s+(?:minha\s+)?confirmacao)/g, "")
    .replace(/se ja estiverem corretos,?\s*nao grave nada/g, "");
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
