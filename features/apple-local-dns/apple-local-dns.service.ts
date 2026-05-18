import { prisma } from "../../lib/prisma";
import { DEFAULT_PROTECTION_POLICY_SLUG } from "../security-center/protection-policy.service";

type BlocklistEntryRecord = {
  value: string;
  type: "DOMAIN" | "URL_KEYWORD";
  note: string | null;
};

export type AppleLocalDnsPolicy = {
  policyId: string;
  policyName: string;
  policyVersion: number;
  sourceCount: number;
  domains: string[];
  keywords: string[];
  updatedAt: string;
};

export type AppleDnsDecision = {
  shouldBlock: boolean;
  matchedValue?: string;
  matchedType?: "DOMAIN" | "URL_KEYWORD";
};

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function buildDecision(host: string, domains: string[], keywords: string[]): AppleDnsDecision {
  const normalizedHost = normalizeValue(host);

  for (const domain of domains) {
    if (normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)) {
      return {
        shouldBlock: true,
        matchedValue: domain,
        matchedType: "DOMAIN"
      };
    }
  }

  for (const keyword of keywords) {
    if (normalizedHost.includes(keyword)) {
      return {
        shouldBlock: true,
        matchedValue: keyword,
        matchedType: "URL_KEYWORD"
      };
    }
  }

  return { shouldBlock: false };
}

export async function loadAppleLocalDnsPolicy(): Promise<AppleLocalDnsPolicy> {
  const policy = await (prisma as any).protectionPolicy.findUnique({
    where: {
      slug: DEFAULT_PROTECTION_POLICY_SLUG
    },
    include: {
      sources: {
        where: {
          isEnabled: true
        },
        include: {
          entries: {
            where: {
              isActive: true
            },
            select: {
              value: true,
              type: true,
              note: true
            }
          }
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!policy) {
    throw new Error("Nenhuma política padrão de proteção foi encontrada para o DNS local Apple.");
  }

  const entries: BlocklistEntryRecord[] = policy.sources.flatMap(
    (source: { entries: BlocklistEntryRecord[] }) => source.entries
  );
  const domains = Array.from(
    new Set(
      entries
        .filter((entry: BlocklistEntryRecord) => entry.type === "DOMAIN")
        .map((entry: BlocklistEntryRecord) => normalizeValue(entry.value))
    )
  ).sort((left, right) => left.localeCompare(right));
  const keywords = Array.from(
    new Set(
      entries
        .filter((entry: BlocklistEntryRecord) => entry.type === "URL_KEYWORD")
        .map((entry: BlocklistEntryRecord) => normalizeValue(entry.value))
    )
  ).sort((left, right) => left.localeCompare(right));

  return {
    policyId: policy.id,
    policyName: policy.name,
    policyVersion: policy.version,
    sourceCount: policy.sources.length,
    domains,
    keywords,
    updatedAt: new Date().toISOString()
  };
}

export function decideAppleLocalDnsBlock(host: string, policy: AppleLocalDnsPolicy) {
  return buildDecision(host, policy.domains, policy.keywords);
}
