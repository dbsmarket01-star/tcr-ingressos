import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/request-host";

export const DEFAULT_PLATFORM_NAME = "Ingresaas";
export const DEFAULT_PLATFORM_DOMAIN = "ingresaas.app.br";
const LEGACY_PLATFORM_DOMAINS = ["ingressas.app.br"];

function getAcceptedPlatformHosts() {
  const configuredHost = normalizeHost(process.env.PLATFORM_DOMAIN);
  const hosts = new Set<string>([DEFAULT_PLATFORM_DOMAIN, ...LEGACY_PLATFORM_DOMAINS]);

  if (configuredHost) {
    hosts.add(configuredHost);
  }

  for (const host of Array.from(hosts)) {
    hosts.add(`www.${host}`);
  }

  return hosts;
}

export function getPlatformName() {
  return process.env.PLATFORM_NAME?.trim() || DEFAULT_PLATFORM_NAME;
}

export function getPlatformHost() {
  return normalizeHost(process.env.PLATFORM_DOMAIN) || DEFAULT_PLATFORM_DOMAIN;
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

  if (!normalizedHost) {
    return false;
  }

  return getAcceptedPlatformHosts().has(normalizedHost);
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
  totalPlatformLeads: number;
  recentPlatformLeads: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    annualRevenueBand: string;
    instagramHandle: string | null;
    eventNiche: string;
    createdAt: Date;
  }>;
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
    paidRevenueInCents: number;
    paidOrdersCount: number;
    leadsCount: number;
    readinessScore: number;
    readinessLabel: string;
    readinessItems: Array<{
      label: string;
      done: boolean;
    }>;
  }>;
};

function buildReadiness(operation: {
  publicDomain: string | null;
  adminDomain: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  eventCount: number;
  adminCount: number;
}) {
  const readinessItems = [
    { label: "Domínio público", done: Boolean(operation.publicDomain) },
    { label: "Domínio admin", done: Boolean(operation.adminDomain) },
    { label: "Suporte", done: Boolean(operation.supportEmail || operation.supportPhone) },
    { label: "Branding", done: Boolean(operation.primaryColor && operation.secondaryColor) },
    { label: "Equipe inicial", done: operation.adminCount > 0 },
    { label: "Primeiro evento", done: operation.eventCount > 0 }
  ];
  const completed = readinessItems.filter((item) => item.done).length;
  const readinessScore = Math.round((completed / readinessItems.length) * 100);
  const readinessLabel =
    readinessScore >= 100 ? "Pronta" : readinessScore >= 67 ? "Quase pronta" : readinessScore >= 34 ? "Em preparação" : "Inicial";

  return {
    readinessItems,
    readinessScore,
    readinessLabel
  };
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [organizations, totalEvents, publishedEvents, totalAdmins, totalPlatformLeads, recentPlatformLeads] = await Promise.all([
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
    prisma.adminUser.count(),
    prisma.platformLead.count(),
    prisma.platformLead.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 6,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        annualRevenueBand: true,
        instagramHandle: true,
        eventNiche: true,
        createdAt: true
      }
    })
  ]);

  const domainsConfigured = organizations.filter((item) => item.publicDomain || item.adminDomain).length;
  const fullyConfiguredOrganizations = organizations.filter((item) => item.publicDomain && item.adminDomain).length;
  const childOrganizations = Math.max(organizations.length - 1, 0);
  const metricsByOrganization = new Map(
    (
      await Promise.all(
        organizations.map(async (item) => {
          const [paidOrdersCount, leadsCount, paidRevenue] = await prisma.$transaction([
            prisma.order.count({
              where: {
                event: {
                  organizationId: item.id
                },
                status: "PAID"
              }
            }),
            prisma.eventLead.count({
              where: {
                event: {
                  organizationId: item.id
                }
              }
            }),
            prisma.order.aggregate({
              where: {
                event: {
                  organizationId: item.id
                },
                status: "PAID"
              },
              _sum: {
                totalInCents: true
              }
            })
          ]);

          return [
            item.id,
            {
              paidOrdersCount,
              leadsCount,
              paidRevenueInCents: paidRevenue._sum.totalInCents ?? 0
            }
          ] as const;
        })
      )
    ).map(([id, metrics]) => [id, metrics] as const)
  );

  return {
    totalOrganizations: organizations.length,
    activeOrganizations: organizations.filter((item) => item.isActive).length,
    domainsConfigured,
    fullyConfiguredOrganizations,
    totalEvents,
    publishedEvents,
    totalAdmins,
    childOrganizations,
    totalPlatformLeads,
    recentPlatformLeads,
    operations: organizations.map((item) => ({
      ...(metricsByOrganization.get(item.id) ?? {
        paidOrdersCount: 0,
        leadsCount: 0,
        paidRevenueInCents: 0
      }),
      ...buildReadiness({
        publicDomain: item.publicDomain,
        adminDomain: item.adminDomain,
        supportEmail: item.supportEmail,
        supportPhone: item.supportPhone,
        primaryColor: item.primaryColor,
        secondaryColor: item.secondaryColor,
        eventCount: item._count.events,
        adminCount: item._count.adminUsers
      }),
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
