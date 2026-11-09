function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isReadOnlyAssistantRequest(message: string) {
  return /\b(nao\s+(?:altere|mude|modifique|faca\s+alteracoes)|sem\s+(?:alterar|mudar|modificar)|(?:so|apenas|somente)\s+(?:consulte|consultar|consulta|informe|informar))\b/.test(normalize(message));
}

export function assistantAcknowledgement(message: string) {
  return isReadOnlyAssistantRequest(message)
    ? "Entendi. Vou conferir os dados e não farei nenhuma alteração."
    : "Entendi. Vou conferir os dados. Se houver alguma mudança, mostrarei a proposta para sua confirmação antes de salvar.";
}
