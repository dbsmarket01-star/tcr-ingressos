function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isReadOnlyAssistantRequest(message: string) {
  const request = normalize(message).trim();
  // A restriction on other fields must not cancel an explicit change request.
  if (/^(?:por favor[,\s]+)?(?:retire|tire|pause|despublique|publique|reative|deixe|altere|mude|modifique|aumente|reduza)\b/.test(request)) return false;
  return /\b(nao\s+(?:altere|mude|modifique|faca\s+alteracoes)|sem\s+(?:alterar|mudar|modificar)|(?:so|apenas|somente)\s+(?:consulte|consultar|consulta|informe|informar))\b/.test(request);
}

export function assistantAcknowledgement(message: string) {
  return isReadOnlyAssistantRequest(message)
    ? "Entendi. Vou conferir os dados e não farei nenhuma alteração."
    : "Entendi. Vou conferir os dados. Se houver alguma mudança, mostrarei a proposta para sua confirmação antes de salvar.";
}
