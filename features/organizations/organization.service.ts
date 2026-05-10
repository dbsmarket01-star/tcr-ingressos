import { prisma } from "@/lib/prisma";
import { getPlatformAppUrl, getPlatformHost, getPlatformName, isPlatformHost } from "@/features/platform/platform.service";
import { getRequestHost, normalizeHost } from "@/lib/request-host";
import { unstable_cache } from "next/cache";

export const DEFAULT_ORGANIZATION_SLUG = "tcr-ingressos";
export const DEFAULT_ORGANIZATION_NAME = "TCR Ingressos";
export const A2_IMERGIDOS_ORGANIZATION_SLUG = "a2-imergidos";
export const A2_IMERGIDOS_PRIMARY_COLOR = "#005f8f";
export const A2_IMERGIDOS_SECONDARY_COLOR = "#ffffff";
const UNMATCHED_HOST_ORGANIZATION_ID = "__unmatched_host__";

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
  brandLogoUrl: string | null;
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

function isLocalDevelopmentHost(host?: string | null) {
  const normalizedHost = normalizeHost(host);

  return !normalizedHost || normalizedHost === "localhost" || normalizedHost.startsWith("127.");
}

function buildUnmatchedHostOrganization(): OrganizationBranding {
  return {
    id: UNMATCHED_HOST_ORGANIZATION_ID,
    slug: "ingresaas-unmatched-host",
    name: getPlatformName(),
    publicDomain: getPlatformHost(),
    adminDomain: null,
    logoUrl: null,
    primaryColor: "#1f5fbf",
    secondaryColor: "#ffffff",
    supportEmail: null,
    supportPhone: null,
    isActive: false
  };
}

function resolveOrganizationBranding(organization: OrganizationBranding): OrganizationBranding {
  if (organization.slug !== A2_IMERGIDOS_ORGANIZATION_SLUG) {
    return organization;
  }

  return {
    ...organization,
    primaryColor: A2_IMERGIDOS_PRIMARY_COLOR,
    secondaryColor: A2_IMERGIDOS_SECONDARY_COLOR
  };
}

function buildOrganizationContext(
  organization: OrganizationBranding,
  requestHost: string | null,
  isMatchedByHost: boolean
): OrganizationContext {
  const resolvedOrganization = resolveOrganizationBranding(organization);
  const normalizedRequestHost = normalizeHost(requestHost);
  const normalizedAdminHost = normalizeHost(resolvedOrganization.adminDomain);
  const publicBaseUrl = buildHttpsUrl(resolvedOrganization.publicDomain) || getFallbackPublicBaseUrl();
  const platformHost = getPlatformHost();
  const platformName = getPlatformName();
  const platformMode = isPlatformHost(normalizedRequestHost) || resolvedOrganization.id === UNMATCHED_HOST_ORGANIZATION_ID;
  const displayName = platformMode ? platformName : resolvedOrganization.name;

  return {
    organization: resolvedOrganization,
    requestHost: normalizedRequestHost,
    isMatchedByHost,
    isAdminHost: Boolean(normalizedRequestHost && normalizedAdminHost && normalizedRequestHost === normalizedAdminHost),
    isPlatformHost: platformMode,
    platformName,
    platformHost,
    platformAppUrl: getPlatformAppUrl(),
    publicBaseUrl,
    adminBaseUrl: buildHttpsUrl(resolvedOrganization.adminDomain),
    brandName: displayName,
    brandMark: displayName.trim().charAt(0).toUpperCase() || "I",
    brandLogoUrl: platformMode ? null : resolvedOrganization.logoUrl
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
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: organizationBrandingSelect
  });

  return organization ? resolveOrganizationBranding(organization) : null;
}

export async function getOrganizationByHost(host?: string | null) {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    return null;
  }

  const hostCandidates = Array.from(
    new Set(
      [normalizedHost, normalizedHost.startsWith("www.") ? normalizedHost.slice(4) : null].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  return unstable_cache(
    async (...lookupHosts: string[]) =>
      prisma.organization.findFirst({
        where: {
          isActive: true,
          OR: [
            { publicDomain: { in: lookupHosts } },
            { adminDomain: { in: lookupHosts } }
          ]
        },
        select: organizationBrandingSelect
      }),
    ["organization-by-host"],
    { revalidate: 60 }
  )(...hostCandidates);
}

export async function getDefaultOrganizationId() {
  const organization = await ensureDefaultOrganization();
  return organization.id;
}

export async function getOrganizationContextByHost(host?: string | null) {
  const matchedOrganization = await getOrganizationByHost(host);

  if (matchedOrganization) {
    return buildOrganizationContext(matchedOrganization, host || null, true);
  }

  if (isPlatformHost(host) || !isLocalDevelopmentHost(host)) {
    return buildOrganizationContext(buildUnmatchedHostOrganization(), host || null, false);
  }

  const fallback = await ensureDefaultOrganization();

  return buildOrganizationContext(fallback, host || null, false);
}

export async function getOrganizationContextById(organizationId: string) {
  const organization = await getOrganizationBrandingById(organizationId);

  if (!organization) {
    throw new Error("Organização não encontrada para o contexto solicitado.");
  }

  return buildOrganizationContext(organization, organization.publicDomain, true);
}

export async function getCurrentOrganizationContext() {
  const host = await getRequestHost();
  return getOrganizationContextByHost(host);
}
