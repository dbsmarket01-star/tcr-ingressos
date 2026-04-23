import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/request-host";

export const DEFAULT_PLATFORM_NAME = "Ingresaas";
export const DEFAULT_PLATFORM_DOMAIN = "ingresaas.app.br";

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

export type PlatformOverview = {
  totalOrganizations: number;
  activeOrganizations: number;
  domainsConfigured: number;
  fullyConfiguredOrganizations: number;
  totalEvents: number;
  publishedEvents: number;
  totalAdmins: number;
  childOrganizations: number;
  operations: Array<{
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    publicDomain: string | null;
    adminDomain: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    eventCount: number;
    adminCount: number;
  }>;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [organizations, totalEvents, publishedEvents, totalAdmins] = await Promise.all([
    prisma.organization.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        publicDomain: true,
        adminDomain: true,
        supportEmail: true,
        supportPhone: true,
        primaryColor: true,
        secondaryColor: true,
        _count: {
          select: {
            events: true,
            adminUsers: true
          }
        }
      }
    }),
    prisma.event.count(),
    prisma.event.count({
      where: {
        status: "PUBLISHED"
      }
    }),
    prisma.adminUser.count()
  ]);

  const domainsConfigured = organizations.filter((item) => item.publicDomain || item.adminDomain).length;
  const fullyConfiguredOrganizations = organizations.filter((item) => item.publicDomain && item.adminDomain).length;
  const childOrganizations = Math.max(organizations.length - 1, 0);

  return {
    totalOrganizations: organizations.length,
    activeOrganizations: organizations.filter((item) => item.isActive).length,
    domainsConfigured,
    fullyConfiguredOrganizations,
    totalEvents,
    publishedEvents,
    totalAdmins,
    childOrganizations,
    operations: organizations.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      isActive: item.isActive,
      publicDomain: item.publicDomain,
      adminDomain: item.adminDomain,
      supportEmail: item.supportEmail,
      supportPhone: item.supportPhone,
      primaryColor: item.primaryColor,
      secondaryColor: item.secondaryColor,
      eventCount: item._count.events,
      adminCount: item._count.adminUsers
    }))
  };
}
