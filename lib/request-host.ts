import { headers } from "next/headers";

export function normalizeHost(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const [host] = withoutProtocol.split("/");
  const withoutPort = host?.split(":")[0]?.trim();

  return withoutPort || null;
}

export async function getRequestHost() {
  const headerStore = await headers();

  return normalizeHost(
    headerStore.get("x-forwarded-host") || headerStore.get("x-original-host") || headerStore.get("host")
  );
}
