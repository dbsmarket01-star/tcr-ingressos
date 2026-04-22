import { normalizeHost } from "@/lib/request-host";

export const DEFAULT_PLATFORM_NAME = "Ingressas";
export const DEFAULT_PLATFORM_DOMAIN = "ingressas.app.br";

export function getPlatformName() {
  return process.env.PLATFORM_NAME?.trim() || DEFAULT_PLATFORM_NAME;
}

export function getPlatformHost() {
  return normalizeHost(process.env.PLATFORM_DOMAIN || DEFAULT_PLATFORM_DOMAIN);
}

export function getPlatformAppUrl() {
  const host = getPlatformHost();

  if (!host) {
    return "http://localhost:3000";
  }

  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    return `http://${host}`;
  }

  return `https://${host}`;
}

export function isPlatformHost(host?: string | null) {
  const normalizedHost = normalizeHost(host);
  const platformHost = getPlatformHost();

  return Boolean(normalizedHost && platformHost && normalizedHost === platformHost);
}
