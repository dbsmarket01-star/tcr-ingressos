type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function getTurnstileSecret() {
  return process.env.TURNSTILE_SECRET_KEY || null;
}

export function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
}

export async function verifyTurnstileToken(token?: string | null, remoteIp?: string | null) {
  const secret = getTurnstileSecret();

  if (!secret) {
    return true;
  }

  if (!token) {
    throw new Error("Confirme a verificação anti-bot antes de enviar seu cadastro.");
  }

  const body = new URLSearchParams({
    secret,
    response: token
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Não foi possível validar a proteção anti-bot no momento.");
  }

  const payload = (await response.json()) as TurnstileResponse;

  if (!payload.success) {
    const errorCodes = payload["error-codes"] || [];

    if (errorCodes.includes("timeout-or-duplicate")) {
      throw new Error("Confirme a verificação novamente e envie seu cadastro mais uma vez.");
    }

    throw new Error("A validação anti-bot falhou. Atualize a página e tente novamente.");
  }

  return true;
}
