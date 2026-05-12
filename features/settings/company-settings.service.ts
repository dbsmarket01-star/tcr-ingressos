import { unstable_cache } from "next/cache";
import { getDefaultOrganizationId } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import type { CompanySettingsInput } from "./company-settings.schema";

export const COMPANY_SETTINGS_ID = "tcr-company-settings";

async function createCompanySettingsForOrganization(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: {
      id: organizationId
    },
    select: {
      id: true,
      slug: true,
      name: true,
      publicDomain: true,
      supportEmail: true
    }
  });

  if (!organization) {
    throw new Error("Organização não encontrada para criar configurações da empresa.");
  }

  return prisma.companySettings.create({
    data: {
      ...(organization.slug === "tcr-ingressos" ? { id: COMPANY_SETTINGS_ID } : {}),
      organizationId,
      companyName: organization.name,
      tradeName: organization.name,
      document: "00.000.000/0001-00",
      supportEmail: organization.supportEmail || "contato@ingressaas.com",
      supportPhone: null,
      instagramUrl: null,
      facebookUrl: null,
      youtubeUrl: null,
      whatsappUrl: null,
      footerDescription: null,
      footerAboutTitle: null,
      footerAboutContent: null,
      footerHowItWorksTitle: null,
      footerHowItWorksContent: null,
      footerTermsTitle: null,
      footerTermsContent: null,
      footerPrivacyTitle: null,
      footerPrivacyContent: null,
      footerHelpTitle: null,
      footerHelpContent: null,
      footerFaqTitle: null,
      footerFaqContent: null,
      footerContactTitle: null,
      footerContactContent: null,
      defaultCurrency: "BRL",
      platformFeeBps: 0,
      orderReservationMinutes: 120,
      cardPendingReservationMinutes: 30
    }
  });
}

export async function getCompanySettingsByOrganizationId(organizationId: string) {
  const settings = await unstable_cache(
    async (lookupOrganizationId: string) =>
      prisma.companySettings.findUnique({
        where: {
          organizationId: lookupOrganizationId
        }
      }),
    ["company-settings-by-organization"],
    { revalidate: 60 }
  )(organizationId);

  if (settings) {
    return settings;
  }

  return createCompanySettingsForOrganization(organizationId);
}

export async function getCompanySettings(organizationId?: string) {
  const resolvedOrganizationId = organizationId || (await getDefaultOrganizationId());
  return getCompanySettingsByOrganizationId(resolvedOrganizationId);
}

export async function getOrderReservationMinutes(organizationId?: string) {
  const settings = await getCompanySettings(organizationId);
  return settings.orderReservationMinutes;
}

export async function updateCompanySettings(input: CompanySettingsInput, organizationId: string) {
  const existing = await prisma.companySettings.findUnique({
    where: {
      organizationId
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return prisma.companySettings.update({
      where: {
        id: existing.id
      },
      data: {
        companyName: input.companyName,
        tradeName: input.tradeName,
        document: input.document,
        supportEmail: input.supportEmail,
        supportPhone: input.supportPhone || null,
        instagramUrl: input.instagramUrl || null,
        facebookUrl: input.facebookUrl || null,
        youtubeUrl: input.youtubeUrl || null,
        whatsappUrl: input.whatsappUrl || null,
        footerDescription: input.footerDescription || null,
        footerAboutTitle: input.footerAboutTitle || null,
        footerAboutContent: input.footerAboutContent || null,
        footerHowItWorksTitle: input.footerHowItWorksTitle || null,
        footerHowItWorksContent: input.footerHowItWorksContent || null,
        footerTermsTitle: input.footerTermsTitle || null,
        footerTermsContent: input.footerTermsContent || null,
        footerPrivacyTitle: input.footerPrivacyTitle || null,
        footerPrivacyContent: input.footerPrivacyContent || null,
        footerHelpTitle: input.footerHelpTitle || null,
        footerHelpContent: input.footerHelpContent || null,
        footerFaqTitle: input.footerFaqTitle || null,
        footerFaqContent: input.footerFaqContent || null,
        footerContactTitle: input.footerContactTitle || null,
        footerContactContent: input.footerContactContent || null,
        defaultCurrency: input.defaultCurrency.toUpperCase(),
        platformFeeBps: Math.round(input.platformFeePercent * 100),
        orderReservationMinutes: input.orderReservationMinutes,
        cardPendingReservationMinutes: input.cardPendingReservationMinutes
      }
    });
  }

  return prisma.companySettings.create({
    data: {
      ...(organizationId === (await getDefaultOrganizationId()) ? { id: COMPANY_SETTINGS_ID } : {}),
      organizationId,
      companyName: input.companyName,
      tradeName: input.tradeName,
      document: input.document,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone || null,
      instagramUrl: input.instagramUrl || null,
      facebookUrl: input.facebookUrl || null,
      youtubeUrl: input.youtubeUrl || null,
      whatsappUrl: input.whatsappUrl || null,
      footerDescription: input.footerDescription || null,
      footerAboutTitle: input.footerAboutTitle || null,
      footerAboutContent: input.footerAboutContent || null,
      footerHowItWorksTitle: input.footerHowItWorksTitle || null,
      footerHowItWorksContent: input.footerHowItWorksContent || null,
      footerTermsTitle: input.footerTermsTitle || null,
      footerTermsContent: input.footerTermsContent || null,
      footerPrivacyTitle: input.footerPrivacyTitle || null,
      footerPrivacyContent: input.footerPrivacyContent || null,
      footerHelpTitle: input.footerHelpTitle || null,
      footerHelpContent: input.footerHelpContent || null,
      footerFaqTitle: input.footerFaqTitle || null,
      footerFaqContent: input.footerFaqContent || null,
      footerContactTitle: input.footerContactTitle || null,
      footerContactContent: input.footerContactContent || null,
      defaultCurrency: input.defaultCurrency.toUpperCase(),
      platformFeeBps: Math.round(input.platformFeePercent * 100),
      orderReservationMinutes: input.orderReservationMinutes,
      cardPendingReservationMinutes: input.cardPendingReservationMinutes
    }
  });
}
