type FriendlyErrorKind = "not-found" | "validation" | "auth" | "conflict" | "network" | "payment" | "generic";

type FriendlyError = {
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
    .replace(/PrismaClientKnownRequestError/gi, "")
    .replace(/Error:/gi, "")
    .trim();
}

export function getFriendlyError(input: unknown, fallbackMessage = "Não foi possível concluir esta ação. Tente novamente em instantes."): FriendlyError {
  const rawMessage = stripTechnicalNoise(normalizeRawError(input));
  const lower = rawMessage.toLowerCase();

  if (!rawMessage || lower === "next_redirect") {
    return {
      kind: "generic",
      title: "Não foi possível concluir",
      message: fallbackMessage
    };
  }

  if (
    lower === "not found" ||
    lower === "not-found" ||
    lower.includes("not found") ||
    lower.includes("not-found") ||
    lower.includes("nao encontrado") ||
    lower.includes("não encontrado") ||
    lower.includes("não encontramos") ||
    lower.includes("nao encontramos") ||
    lower.includes("p2025")
  ) {
    return {
      kind: "not-found",
      title: "Página ou registro não encontrado",
      message: "Não encontramos o que você procura. Verifique se o link está correto ou volte para a tela anterior."
    };
  }

  if (
    lower.includes("email invalid") ||
    lower.includes("invalid email") ||
    lower.includes("e-mail invalido") ||
    lower.includes("e-mail inválido")
  ) {
    return {
      kind: "validation",
      title: "E-mail inválido",
      message: "Informe um e-mail válido, no formato nome@dominio.com, e tente novamente."
    };
  }

  if (lower.includes("invalid") || lower.includes("inválid") || lower.includes("invalido")) {
    return {
      kind: "validation",
      title: "Informação inválida",
      message: "Alguma informação enviada não está no formato correto. Revise os campos destacados e tente novamente."
    };
  }

  if (lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("não autorizado") || lower.includes("nao autorizado")) {
    return {
      kind: "auth",
      title: "Acesso não autorizado",
      message: "Você não tem permissão para acessar esta área ou sua sessão expirou. Entre novamente e tente outra vez."
    };
  }

  if (lower.includes("unique constraint") || lower.includes("já está em uso") || lower.includes("ja esta em uso") || lower.includes("já existe")) {
    return {
      kind: "conflict",
      title: "Cadastro já existente",
      message: "Já existe um registro com essas informações. Confira os dados antes de tentar novamente."
    };
  }

  if (lower.includes("fetch failed") || lower.includes("timeout") || lower.includes("econn") || lower.includes("network")) {
    return {
      kind: "network",
      title: "Falha de conexão",
      message: "Não conseguimos conversar com um serviço externo agora. Aguarde alguns instantes e tente novamente."
    };
  }

  if (lower.includes("pagamento") || lower.includes("asaas") || lower.includes("cartão") || lower.includes("cartao") || lower.includes("pix")) {
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
