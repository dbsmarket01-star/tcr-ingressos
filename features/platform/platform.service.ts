import { prisma } from "@/lib/prisma";
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

export type PlatformOverview = {
  totalOrganizations: number;
  activeOrganizations: number;
  domainsConfigured: number;
  totalEvents: number;
  publishedEvents: number;
  totalAdmins: number;
  operations: Array<{
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    publicDomain: string | null;
    adminDomain: string | null;
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

  return {
    totalOrganizations: organizations.length,
    activeOrganizations: organizations.filter((item) => item.isActive).length,
    domainsConfigured,
    totalEvents,
    publishedEvents,
    totalAdmins,
    operations: organizations.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      isActive: item.isActive,
      publicDomain: item.publicDomain,
      adminDomain: item.adminDomain,
      eventCount: item._count.events,
      adminCount: item._count.adminUsers
    }))
  };
}
