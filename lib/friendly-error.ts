export type FriendlyErrorKind = "not-found" | "validation" | "auth" | "conflict" | "network" | "payment" | "generic";

export type FriendlyError = {
  kind: FriendlyErrorKind;
  title: string;
  message: string;
};

function normalizeRawError(value: unknown) {
  if (!value) {
    return "";
  }

  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}

function stripTechnicalNoise(message: string) {
  return message
    .replace(/NEXT_HTTP_ERROR_FALLBACK;404/gi, "Not Found")
    .replace(/NEXT_NOT_FOUND/gi, "Not Found")
    .replace(/404:\s*/gi, "")
    .replace(/\b404\b/gi, "Not Found")
    .replace(/PrismaClientKnownRequestError/gi, "")
    .replace(/PrismaClientValidationError/gi, "")
    .replace(/PrismaClientInitializationError/gi, "")
    .replace(/Error:/gi, "")
    .trim();
}

function normalizeForMatching(message: string) {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function getFriendlyError(input: unknown, fallbackMessage = "Não foi possível concluir esta ação. Tente novamente em instantes."): FriendlyError {
  const rawMessage = stripTechnicalNoise(normalizeRawError(input));
  const normalized = normalizeForMatching(rawMessage);

  if (!rawMessage || normalized === "next redirect") {
    return {
      kind: "generic",
      title: "Não foi possível concluir",
      message: fallbackMessage
    };
  }

  if (
    normalized === "not found" ||
    hasAny(normalized, [
      "not found",
      "nao encontrado",
      "nao encontrada",
      "nao encontramos",
      "registro inexistente",
      "pagina inexistente",
      "page not found",
      "resource not found",
      "p2025"
    ])
  ) {
    return {
      kind: "not-found",
      title: "Página não encontrada",
      message:
        "Não encontramos o que você procura. O link pode estar incorreto, a função pode não existir para esta operação ou o registro pode ter sido removido."
    };
  }

  if (
    hasAny(normalized, ["email invalid", "invalid email", "e mail invalido", "email invalido"])
  ) {
    return {
      kind: "validation",
      title: "E-mail inválido",
      message: "Informe um e-mail válido, no formato nome@dominio.com, e tente novamente."
    };
  }

  if (hasAny(normalized, ["invalid", "invalido", "dados invalidos", "campo obrigatorio", "required"])) {
    return {
      kind: "validation",
      title: "Informação inválida",
      message: "Alguma informação enviada não está no formato correto. Revise os campos destacados e tente novamente."
    };
  }

  if (hasAny(normalized, ["unauthorized", "forbidden", "nao autorizado", "nao autenticado", "sem permissao", "sessao expirada"])) {
    return {
      kind: "auth",
      title: "Acesso não autorizado",
      message: "Você não tem permissão para acessar esta área ou sua sessão expirou. Entre novamente e tente outra vez."
    };
  }

  if (hasAny(normalized, ["unique constraint", "ja esta em uso", "ja existe", "duplicado", "duplicate"])) {
    return {
      kind: "conflict",
      title: "Cadastro já existente",
      message: "Já existe um registro com essas informações. Confira os dados antes de tentar novamente."
    };
  }

  if (hasAny(normalized, ["fetch failed", "timeout", "econn", "network", "connection", "conexao"])) {
    return {
      kind: "network",
      title: "Falha de conexão",
      message: "Não conseguimos conversar com um serviço externo agora. Aguarde alguns instantes e tente novamente."
    };
  }

  if (hasAny(normalized, ["pagamento", "asaas", "cartao", "pix", "mercado pago"])) {
    return {
      kind: "payment",
      title: "Pagamento não concluído",
      message: rawMessage
    };
  }

  return {
    kind: "generic",
    title: "Algo precisa de atenção",
    message: rawMessage || fallbackMessage
  };
}

export function getFriendlyErrorMessage(input: unknown, fallbackMessage?: string) {
  return getFriendlyError(input, fallbackMessage).message;
}
