import { prisma } from "@/lib/prisma";
import type { ProtectionPolicyInput } from "./protection-policy.schema";

export const DEFAULT_PROTECTION_POLICY_SLUG = "default";
const blocklistEntryType = {
  DOMAIN: "DOMAIN",
  URL_KEYWORD: "URL_KEYWORD"
} as const;

const defaultPornographyEntries = [
  { value: "porn", type: blocklistEntryType.URL_KEYWORD, note: "Palavra-chave central" },
  { value: "xxx", type: blocklistEntryType.URL_KEYWORD, note: "Marcador comum de conteudo adulto" },
  { value: "sex", type: blocklistEntryType.URL_KEYWORD, note: "Termo amplo para triagem inicial" },
  { value: "xvideos.com", type: blocklistEntryType.DOMAIN, note: "Dominio conhecido" },
  { value: "pornhub.com", type: blocklistEntryType.DOMAIN, note: "Dominio conhecido" },
  { value: "redtube.com", type: blocklistEntryType.DOMAIN, note: "Dominio conhecido" },
  { value: "xnxx.com", type: blocklistEntryType.DOMAIN, note: "Dominio conhecido" },
  { value: "onlyfans.com", type: blocklistEntryType.DOMAIN, note: "Dominio sensivel para o escopo do produto" },
  { value: "brazzers.com", type: blocklistEntryType.DOMAIN, note: "Dominio conhecido" }
];

export async function getOrCreateDefaultProtectionPolicy() {
  const existing = await (prisma as any).protectionPolicy.findUnique({
    where: {
      slug: DEFAULT_PROTECTION_POLICY_SLUG
    },
    include: {
      sources: {
        include: {
          entries: {
            where: { isActive: true },
            orderBy: [{ type: "asc" }, { value: "asc" }]
          }
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (existing) {
    return existing;
  }

  return (prisma as any).protectionPolicy.create({
    data: {
      slug: DEFAULT_PROTECTION_POLICY_SLUG,
      name: "Politica padrão Guerra à Pornografia",
      description: "Politica central do MVP para pornografia, VPN local e deteccao de bypass.",
      sources: {
        create: [
          {
            code: "core-pornography",
            name: "Core pornography blocklist",
            description: "Lista inicial de dominios e palavras-chave prioritarias para o MVP.",
            priority: 10,
            entries: {
              create: defaultPornographyEntries
            }
          }
        ]
      }
    },
    include: {
      sources: {
        include: {
          entries: {
            where: { isActive: true },
            orderBy: [{ type: "asc" }, { value: "asc" }]
          }
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
      }
    }
  });
}

export async function updateDefaultProtectionPolicy(input: ProtectionPolicyInput) {
  const policy = await getOrCreateDefaultProtectionPolicy();

  return (prisma as any).protectionPolicy.update({
    where: { id: policy.id },
    data: {
      name: input.name,
      description: input.description || null,
      targetPornographyOnly: input.targetPornographyOnly,
      enforceAndroidVpn: input.enforceAndroidVpn,
      enforceIosDnsProxy: input.enforceIosDnsProxy,
      blockUnknownDnsChanges: input.blockUnknownDnsChanges,
      detectExternalVpn: input.detectExternalVpn,
      detectProxy: input.detectProxy,
      detectDeveloperMode: input.detectDeveloperMode,
      pinRequiredToDisable: input.pinRequiredToDisable,
      heartbeatIntervalMinutes: input.heartbeatIntervalMinutes,
      staleHeartbeatGraceMinutes: input.staleHeartbeatGraceMinutes,
      version: {
        increment: 1
      }
    }
  });
}

export async function listProtectionSources() {
  const policy = await getOrCreateDefaultProtectionPolicy();

  return (prisma as any).blocklistSource.findMany({
    where: {
      policyId: policy.id
    },
    include: {
      entries: {
        where: { isActive: true },
        select: {
          id: true
        }
      }
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });
}

export async function getPolicySyncPayload(userId: string) {
  const [policy, sources, user, activeSubscription] = await Promise.all([
    getOrCreateDefaultProtectionPolicy(),
    (prisma as any).blocklistSource.findMany({
      where: {
        policy: {
          slug: DEFAULT_PROTECTION_POLICY_SLUG
        },
        isEnabled: true
      },
      include: {
        entries: {
          where: { isActive: true },
          orderBy: [{ type: "asc" }, { value: "asc" }]
        }
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    }),
    prisma.appUser.findUnique({
      where: { id: userId }
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ["TRIALING", "ACTIVE", "PAST_DUE"]
        }
      },
      include: {
        plan: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  if (!user || !activeSubscription) {
    throw new Error("Nao foi possivel montar a politica do usuario.");
  }

  return {
    policy: {
      id: policy.id,
      slug: policy.slug,
      name: policy.name,
      description: policy.description,
      version: policy.version,
      targetPornographyOnly: policy.targetPornographyOnly,
      enforceAndroidVpn: policy.enforceAndroidVpn,
      enforceIosDnsProxy: policy.enforceIosDnsProxy,
      blockUnknownDnsChanges: policy.blockUnknownDnsChanges,
      detectExternalVpn: policy.detectExternalVpn,
      detectProxy: policy.detectProxy,
      detectDeveloperMode: policy.detectDeveloperMode,
      pinRequiredToDisable: policy.pinRequiredToDisable,
      heartbeatIntervalMinutes: policy.heartbeatIntervalMinutes,
      staleHeartbeatGraceMinutes: policy.staleHeartbeatGraceMinutes
    },
    sources: sources.map((source: any) => ({
      code: source.code,
      name: source.name,
      version: source.version,
      priority: source.priority,
      entries: source.entries.map((entry: any) => ({
        value: entry.value,
        type: entry.type,
        note: entry.note
      }))
    })),
    plan: {
      code: activeSubscription.plan.code,
      maxDevices: activeSubscription.plan.maxDevices,
      trialDays: activeSubscription.plan.trialDays,
      gracePeriodDays: activeSubscription.plan.gracePeriodDays
    }
  };
}
