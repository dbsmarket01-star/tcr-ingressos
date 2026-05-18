import fs from "node:fs";
import path from "node:path";

export type AppleLocalDnsStatus = {
  configured: boolean;
  statePath: string;
  mode: "APPLE_LOCAL_DNS";
  listeningHost?: string;
  listeningPort?: number;
  upstreamDohUrl?: string;
  policyVersion?: number;
  domains?: number;
  keywords?: number;
  localIpv4?: string[];
  refreshedAt?: string;
  error?: string;
};

const STATE_PATH = process.env.APPLE_LOCAL_DNS_STATE_PATH ?? path.join(process.cwd(), "tmp", "apple-local-dns-state.json");

export function readAppleLocalDnsStatus(): AppleLocalDnsStatus {
  if (!fs.existsSync(STATE_PATH)) {
    return {
      configured: false,
      statePath: STATE_PATH,
      mode: "APPLE_LOCAL_DNS"
    };
  }

  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const state = JSON.parse(raw) as Omit<AppleLocalDnsStatus, "configured" | "statePath">;

    return {
      configured: true,
      statePath: STATE_PATH,
      ...state
    };
  } catch (error) {
    return {
      configured: false,
      statePath: STATE_PATH,
      mode: "APPLE_LOCAL_DNS",
      error: error instanceof Error ? error.message : "Falha ao ler o estado do DNS local Apple."
    };
  }
}
