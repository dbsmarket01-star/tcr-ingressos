import { prisma } from "@/lib/prisma";

type CreateOrganizationInput = {
  name: string;
  slug: string;
  publicDomain?: string | null;
  adminDomain?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

type UpdateOrganizationInput = {
  id: string;
  name: string;
  publicDomain?: string | null;
  adminDomain?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

function normalizeValue(value?: string | null) {
  const trimmed = value?.trim() || "";
  return trimmed.length > 0 ? trimmed : null;
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

export async function listOrganizationsForPlatformAdmin() {
  return prisma.organization.findMany({
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
}

export async function createOrganization(input: CreateOrganizationInput) {
  return prisma.organization.create({
    data: {
      name: input.name.trim(),
      slug: slugify(input.slug || input.name),
      publicDomain: normalizeValue(input.publicDomain),
      adminDomain: normalizeValue(input.adminDomain),
      supportEmail: normalizeValue(input.supportEmail),
      supportPhone: normalizeValue(input.supportPhone)
    }
  });
}

export async function updateOrganization(input: UpdateOrganizationInput) {
  return prisma.organization.update({
    where: {
      id: input.id
    },
    data: {
      name: input.name.trim(),
      publicDomain: normalizeValue(input.publicDomain),
      adminDomain: normalizeValue(input.adminDomain),
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

