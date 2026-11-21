const PUBLIC_TCR_HOSTS = new Set([
  "tcringressos.com.br",
  "www.tcringressos.com.br",
  "tcringressos.app.br",
  "www.tcringressos.app.br"
]);

export function resolveCheckoutLandingPage(landingPage: string | undefined, requestHost: string | null) {
  const host = requestHost?.split(",")[0]?.trim().toLowerCase();

  if (!host || !PUBLIC_TCR_HOSTS.has(host)) {
    return landingPage;
  }

  try {
    const source = new URL(landingPage || "/", `https://${host}`);
    return `https://${host}${source.pathname}${source.search}`;
  } catch {
    return `https://${host}/`;
  }
}
