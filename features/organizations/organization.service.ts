import { prisma } from "@/lib/prisma";

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
