import { prisma } from "@/lib/prisma";
import { getPlatformAppUrl, getPlatformHost, getPlatformName, isPlatformHost } from "@/features/platform/platform.service";
import { getRequestHost, normalizeHost } from "@/lib/request-host";

export const DEFAULT_ORGANIZATION_SLUG = "tcr-ingressos";
export const DEFAULT_ORGANIZATION_NAME = "TCR Ingressos";
const DEFAULT_COMPANY_SETTINGS_ID = "tcr-company-settings";

type OrganizationSeedInput = {
  name?: string;
  publicDomain?: string | null;
  adminDomain?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

export type OrganizationBranding = {
  id: string;
  slug: string;
  name: string;
  publicDomain: string | null;
  adminDomain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  isActive: boolean;
};

export type OrganizationContext = {
  organization: OrganizationBranding;
  requestHost: string | null;
  isMatchedByHost: boolean;
  isAdminHost: boolean;
  isPlatformHost: boolean;
  platformName: string;
  platformHost: string | null;
  platformAppUrl: string;
  publicBaseUrl: string;
  adminBaseUrl: string | null;
  brandName: string;
  brandMark: string;
};

const organizationBrandingSelect = {
  id: true,
  slug: true,
  name: true,
  publicDomain: true,
  adminDomain: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  supportEmail: true,
  supportPhone: true,
  isActive: true
} as const;

function getFallbackPublicBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function buildHttpsUrl(host: string | null) {
  if (!host) {
    return null;
  }

  const normalized = normalizeHost(host);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("localhost") || normalized.startsWith("127.0.0.1")) {
    return `http://${normalized}`;
  }

  return `https://${normalized}`;
}

function buildOrganizationContext(
  organization: OrganizationBranding,
  requestHost: string | null,
  isMatchedByHost: boolean
): OrganizationContext {
  const normalizedRequestHost = normalizeHost(requestHost);
  const normalizedAdminHost = normalizeHost(organization.adminDomain);
  const publicBaseUrl = buildHttpsUrl(organization.publicDomain) || getFallbackPublicBaseUrl();
  const platformHost = getPlatformHost();
  const platformName = getPlatformName();

  return {
    organization,
    requestHost: normalizedRequestHost,
    isMatchedByHost,
    isAdminHost: Boolean(normalizedRequestHost && normalizedAdminHost && normalizedRequestHost === normalizedAdminHost),
    isPlatformHost: isPlatformHost(normalizedRequestHost),
    platformName,
    platformHost,
    platformAppUrl: getPlatformAppUrl(),
    publicBaseUrl,
    adminBaseUrl: buildHttpsUrl(organization.adminDomain),
    brandName: organization.name,
    brandMark: organization.name.trim().charAt(0).toUpperCase() || "I"
  };
}

export async function ensureDefaultOrganization(seed?: OrganizationSeedInput) {
  return prisma.organization.upsert({
    where: {
      slug: DEFAULT_ORGANIZATION_SLUG
    },
    update: {
      ...(seed?.name ? { name: seed.name } : {}),
      ...(seed?.publicDomain !== undefined ? { publicDomain: seed.publicDomain } : {}),
      ...(seed?.adminDomain !== undefined ? { adminDomain: seed.adminDomain } : {}),
      ...(seed?.supportEmail !== undefined ? { supportEmail: seed.supportEmail } : {}),
      ...(seed?.supportPhone !== undefined ? { supportPhone: seed.supportPhone } : {})
    },
    create: {
      slug: DEFAULT_ORGANIZATION_SLUG,
      name: seed?.name || DEFAULT_ORGANIZATION_NAME,
      publicDomain: seed?.publicDomain ?? null,
      adminDomain: seed?.adminDomain ?? null,
      supportEmail: seed?.supportEmail ?? null,
      supportPhone: seed?.supportPhone ?? null
    }
  });
}

export async function getOrganizationBrandingById(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    select: organizationBrandingSelect
  });
}

export async function getOrganizationByHost(host?: string | null) {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    return null;
  }

  return prisma.organization.findFirst({
    where: {
      isActive: true,
      OR: [{ publicDomain: normalizedHost }, { adminDomain: normalizedHost }]
    },
    select: organizationBrandingSelect
  });
}

export async function getDefaultOrganizationId() {
  const organization = await ensureDefaultOrganization();
  return organization.id;
}

let defaultOrganizationBackfillPromise: Promise<string> | null = null;

export async function ensureDefaultOrganizationBackfill() {
  if (!defaultOrganizationBackfillPromise) {
    defaultOrganizationBackfillPromise = (async () => {
      const organization = await ensureDefaultOrganization();

      await prisma.$transaction([
        prisma.adminUser.updateMany({
          where: {
            organizationId: null
          },
          data: {
            organizationId: organization.id
          }
        }),
        prisma.event.updateMany({
          where: {
            organizationId: null
          },
          data: {
            organizationId: organization.id
          }
        }),
        prisma.companySettings.updateMany({
          where: {
            id: DEFAULT_COMPANY_SETTINGS_ID,
            organizationId: null
          },
          data: {
            organizationId: organization.id
          }
        }),
        prisma.paymentSplitRule.updateMany({
          where: {
            organizationId: null
          },
          data: {
            organizationId: organization.id
          }
        })
      ]);

      return organization.id;
    })().catch((error) => {
      defaultOrganizationBackfillPromise = null;
      throw error;
    });
  }

  return defaultOrganizationBackfillPromise;
}

export async function getOrganizationContextByHost(host?: string | null) {
  const matchedOrganization = await getOrganizationByHost(host);

  if (matchedOrganization) {
    return buildOrganizationContext(matchedOrganization, host || null, true);
  }

  const fallback = await ensureDefaultOrganization({
    publicDomain: normalizeHost(process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.APP_DOMAIN) ?? undefined,
    adminDomain: normalizeHost(process.env.ADMIN_HOST) ?? undefined
  });

  return buildOrganizationContext(fallback, host || null, false);
}

export async function getCurrentOrganizationContext() {
  const host = await getRequestHost();
  return getOrganizationContextByHost(host);
}
