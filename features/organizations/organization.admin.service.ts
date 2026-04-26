import { prisma } from "@/lib/prisma";
import { getPlatformOverview } from "@/features/platform/platform.service";
import { AdminRole, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

type CreateOrganizationInput = {
  name: string;
  slug: string;
  publicDomain?: string | null;
  adminDomain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPassword?: string | null;
};

type UpdateOrganizationInput = {
  id: string;
  name: string;
  publicDomain?: string | null;
  adminDomain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

type OrganizationConflictInput = {
  slug: string;
  publicDomain?: string | null;
  adminDomain?: string | null;
  ownerEmail?: string | null;
  excludeId?: string | null;
};

function normalizeValue(value?: string | null) {
  const trimmed = value?.trim() || "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value?: string | null) {
  const normalized = normalizeValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeHexColor(value?: string | null) {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return null;
  }

  const hex = normalized.replace(/^#/, "");

  if (!/^[\da-fA-F]{6}$/.test(hex)) {
    return null;
  }

  return `#${hex.toLowerCase()}`;
}

function normalizeDomain(value?: string | null) {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

function validateDomain(value?: string | null) {
  const normalized = normalizeDomain(value);

  if (!normalized) {
    return null;
  }

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    throw new Error("Informe um domínio válido, sem http:// e sem barras.");
  }

  return normalized;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildSecurityState(operation: {
  publicDomain: string | null;
  adminDomain: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  adminCount: number;
}) {
  const issues = [
    !operation.publicDomain ? "Domínio público pendente" : null,
    !operation.adminDomain ? "Domínio admin pendente" : null,
    operation.adminCount === 0 ? "Sem equipe inicial" : null,
    !operation.supportEmail && !operation.supportPhone ? "Suporte não definido" : null
  ].filter(Boolean) as string[];

  if (issues.length === 0) {
    return {
      securityLabel: "Base protegida",
      securityTone: "published",
      securityIssues: issues
    };
  }

  if (issues.length <= 2) {
    return {
      securityLabel: "Quase protegida",
      securityTone: "pending",
      securityIssues: issues
    };
  }

  return {
    securityLabel: "Exige atenção",
    securityTone: "draft",
    securityIssues: issues
  };
}

async function ensureOrganizationUniqueness(
  tx: Prisma.TransactionClient | typeof prisma,
  input: OrganizationConflictInput
) {
  const checks = [
    input.slug
      ? tx.organization.findFirst({
          where: {
            slug: input.slug,
            ...(input.excludeId ? { id: { not: input.excludeId } } : {})
          },
          select: { id: true, name: true }
        })
      : Promise.resolve(null),
    input.publicDomain
      ? tx.organization.findFirst({
          where: {
            publicDomain: input.publicDomain,
            ...(input.excludeId ? { id: { not: input.excludeId } } : {})
          },
          select: { id: true, name: true }
        })
      : Promise.resolve(null),
    input.adminDomain
      ? tx.organization.findFirst({
          where: {
            adminDomain: input.adminDomain,
            ...(input.excludeId ? { id: { not: input.excludeId } } : {})
          },
          select: { id: true, name: true }
        })
      : Promise.resolve(null),
    input.ownerEmail
      ? tx.adminUser.findFirst({
          where: {
            email: input.ownerEmail,
            ...(input.excludeId ? { organizationId: { not: input.excludeId } } : {})
          },
          select: { id: true, name: true }
        })
      : Promise.resolve(null)
  ];

  const [slugConflict, publicDomainConflict, adminDomainConflict, ownerConflict] = await Promise.all(checks);

  if (slugConflict) {
    throw new Error("Já existe um cliente com esse slug interno.");
  }

  if (publicDomainConflict) {
    throw new Error("Esse domínio público já está vinculado a outro cliente.");
  }

  if (adminDomainConflict) {
    throw new Error("Esse domínio admin já está vinculado a outro cliente.");
  }

  if (ownerConflict) {
    throw new Error("O e-mail do usuário inicial já está em uso em outra conta.");
  }
}

export async function listOrganizationsForPlatformAdmin(filters?: {
  query?: string | null;
  status?: "all" | "active" | "inactive" | null;
}) {
  const query = normalizeValue(filters?.query);
  const status = filters?.status ?? "all";
  const organizations = await prisma.organization.findMany({
    where: {
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { publicDomain: { contains: query, mode: "insensitive" } },
              { adminDomain: { contains: query, mode: "insensitive" } },
              { supportEmail: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          adminUsers: true,
          events: true
        }
      }
    }
  });
  const platformOverview = await getPlatformOverview();
  const readinessMap = new Map(platformOverview.operations.map((operation) => [operation.id, operation]));
  const metricsByOrganization = new Map(
    (
      await Promise.all(
        organizations.map(async (organization) => {
          const [paidOrdersCount, totalOrdersCount, leadsCount, paidRevenue] = await prisma.$transaction([
            prisma.order.count({
              where: {
                event: {
                  organizationId: organization.id
                },
                status: "PAID"
              }
            }),
            prisma.order.count({
              where: {
                event: {
                  organizationId: organization.id
                }
              }
            }),
            prisma.eventLead.count({
              where: {
                event: {
                  organizationId: organization.id
                }
              }
            }),
            prisma.order.aggregate({
              where: {
                event: {
                  organizationId: organization.id
                },
                status: "PAID"
              },
              _sum: {
                totalInCents: true
              }
            })
          ]);

          return [
            organization.id,
            {
              paidOrdersCount,
              totalOrdersCount,
              leadsCount,
              paidRevenueInCents: paidRevenue._sum.totalInCents ?? 0
            }
          ] as const;
        })
      )
    ).map(([id, metrics]) => [id, metrics] as const)
  );

  return organizations.map((organization) => {
    const readiness = readinessMap.get(organization.id);
    const metrics = metricsByOrganization.get(organization.id);

    return {
      ...organization,
      readinessScore: readiness?.readinessScore ?? 0,
      readinessLabel: readiness?.readinessLabel ?? "Inicial",
      readinessItems: readiness?.readinessItems ?? [],
      ...buildSecurityState({
        publicDomain: organization.publicDomain,
        adminDomain: organization.adminDomain,
        supportEmail: organization.supportEmail,
        supportPhone: organization.supportPhone,
        adminCount: organization._count.adminUsers
      }),
      paidOrdersCount: metrics?.paidOrdersCount ?? 0,
      totalOrdersCount: metrics?.totalOrdersCount ?? 0,
      leadsCount: metrics?.leadsCount ?? 0,
      paidRevenueInCents: metrics?.paidRevenueInCents ?? 0
    };
  });
}

export async function getOrganizationDetailForPlatformAdmin(id: string) {
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      adminUsers: {
        where: { isActive: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accessAllEvents: true,
          allowedEventIds: true
        }
      },
      events: {
        orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          city: true,
          state: true,
          startsAt: true
        }
      },
      _count: {
        select: {
          adminUsers: true,
          events: true
        }
      }
    }
  });

  if (!organization) {
    return null;
  }

  const [
    paidOrdersCount,
    totalOrdersCount,
    totalLeadsCount,
    activeTicketsCount,
    usedTicketsCount,
    canceledTicketsCount,
    paidRevenue
  ] = await prisma.$transaction([
    prisma.order.count({
      where: {
        event: {
          organizationId: id
        },
        status: "PAID"
      }
    }),
    prisma.order.count({
      where: {
        event: {
          organizationId: id
        }
      }
    }),
    prisma.eventLead.count({
      where: {
        event: {
          organizationId: id
        }
      }
    }),
    prisma.ticket.count({
      where: {
        event: {
          organizationId: id
        },
        status: "ACTIVE"
      }
    }),
    prisma.ticket.count({
      where: {
        event: {
          organizationId: id
        },
        status: "USED"
      }
    }),
    prisma.ticket.count({
      where: {
        event: {
          organizationId: id
        },
        status: "CANCELED"
      }
    }),
    prisma.order.aggregate({
      where: {
        event: {
          organizationId: id
        },
        status: "PAID"
      },
      _sum: {
        totalInCents: true
      }
    })
  ]);

  const platformOverview = await getPlatformOverview();
  const readiness = platformOverview.operations.find((operation) => operation.id === organization.id);
  const securityState = buildSecurityState({
    publicDomain: organization.publicDomain,
    adminDomain: organization.adminDomain,
    supportEmail: organization.supportEmail,
    supportPhone: organization.supportPhone,
    adminCount: organization._count.adminUsers
  });

  return {
    ...organization,
    paidOrdersCount,
    totalOrdersCount,
    totalLeadsCount,
    activeTicketsCount,
    usedTicketsCount,
    canceledTicketsCount,
    paidRevenueInCents: paidRevenue._sum.totalInCents ?? 0,
    readinessScore: readiness?.readinessScore ?? 0,
    readinessLabel: readiness?.readinessLabel ?? "Inicial",
    readinessItems: readiness?.readinessItems ?? [],
    ...securityState
  };
}

export async function createOrganization(input: CreateOrganizationInput) {
  const ownerName = normalizeValue(input.ownerName);
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const ownerPassword = input.ownerPassword?.trim() || "";
  const shouldCreateOwner = Boolean(ownerName && ownerEmail && ownerPassword);
  const passwordHash = shouldCreateOwner ? await bcrypt.hash(ownerPassword, 12) : null;
  const normalizedSlug = slugify(input.slug || input.name);
  const publicDomain = validateDomain(input.publicDomain);
  const adminDomain = validateDomain(input.adminDomain);

  return prisma.$transaction(async (tx) => {
    await ensureOrganizationUniqueness(tx, {
      slug: normalizedSlug,
      publicDomain,
      adminDomain,
      ownerEmail
    });

    const organization = await tx.organization.create({
      data: {
        name: input.name.trim(),
        slug: normalizedSlug,
        publicDomain,
        adminDomain,
        logoUrl: normalizeValue(input.logoUrl),
        primaryColor: normalizeHexColor(input.primaryColor),
        secondaryColor: normalizeHexColor(input.secondaryColor),
        supportEmail: normalizeValue(input.supportEmail),
        supportPhone: normalizeValue(input.supportPhone)
      }
    });

    if (shouldCreateOwner && passwordHash) {
      await tx.adminUser.create({
        data: {
          organizationId: organization.id,
          name: ownerName!,
          email: ownerEmail!,
          passwordHash,
          role: AdminRole.OWNER,
          isActive: true,
          accessAllEvents: true,
          allowedEventIds: []
        }
      });
    }

    return organization;
  });
}

export async function updateOrganization(input: UpdateOrganizationInput) {
  const publicDomain = validateDomain(input.publicDomain);
  const adminDomain = validateDomain(input.adminDomain);

  await ensureOrganizationUniqueness(prisma, {
    slug: "",
    publicDomain,
    adminDomain,
    excludeId: input.id
  });

  return prisma.organization.update({
    where: {
      id: input.id
    },
    data: {
      name: input.name.trim(),
      publicDomain,
      adminDomain,
      logoUrl: normalizeValue(input.logoUrl),
      primaryColor: normalizeHexColor(input.primaryColor),
      secondaryColor: normalizeHexColor(input.secondaryColor),
      supportEmail: normalizeValue(input.supportEmail),
      supportPhone: normalizeValue(input.supportPhone)
    }
  });
}

export async function updateOrganizationStatus(id: string, isActive: boolean) {
  return prisma.organization.update({
    where: {
      id
    },
    data: {
      isActive
    }
  });
}
