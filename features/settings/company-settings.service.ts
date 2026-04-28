import { ensureDefaultOrganizationBackfill } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import type { CompanySettingsInput } from "./company-settings.schema";
import { unstable_cache } from "next/cache";

export const COMPANY_SETTINGS_ID = "tcr-company-settings";

export async function getCompanySettings() {
  const organizationId = await ensureDefaultOrganizationBackfill();
  const settings =
    (await prisma.companySettings.findFirst({
      where: {
        organizationId
      }
    })) ||
    (await prisma.companySettings.findUnique({
      where: {
        id: COMPANY_SETTINGS_ID
      }
    }));

  if (settings) {
    if (!settings.organizationId) {
      return prisma.companySettings.update({
        where: {
          id: settings.id
        },
        data: {
          organizationId
        }
      });
    }

    return settings;
  }

  return prisma.companySettings.create({
    data: {
      id: COMPANY_SETTINGS_ID,
      organizationId,
      companyName: "TCR Ingressos",
      tradeName: "TCR Ingressos",
      document: "00.000.000/0001-00",
      supportEmail: "contato@tcringressos.com.br",
      supportPhone: null,
      instagramUrl: null,
      facebookUrl: null,
      youtubeUrl: null,
      whatsappUrl: null,
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
      prisma.companySettings.findFirst({
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

  return getCompanySettings();
}

export async function getOrderReservationMinutes() {
  const settings = await getCompanySettings();
  return settings.orderReservationMinutes;
}

export async function updateCompanySettings(input: CompanySettingsInput) {
  const organizationId = await ensureDefaultOrganizationBackfill();
  const existing = await prisma.companySettings.findFirst({
    where: {
      organizationId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    const legacy = await prisma.companySettings.findUnique({
      where: {
        id: COMPANY_SETTINGS_ID
      },
      select: {
        id: true
      }
    });

    if (legacy) {
      return prisma.companySettings.update({
        where: {
          id: legacy.id
        },
        data: {
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
          defaultCurrency: input.defaultCurrency.toUpperCase(),
          platformFeeBps: Math.round(input.platformFeePercent * 100),
          orderReservationMinutes: input.orderReservationMinutes,
          cardPendingReservationMinutes: input.cardPendingReservationMinutes
        }
      });
    }
  }

  if (existing) {
    return prisma.companySettings.update({
      where: {
        id: existing.id
      },
      data: {
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
        defaultCurrency: input.defaultCurrency.toUpperCase(),
        platformFeeBps: Math.round(input.platformFeePercent * 100),
        orderReservationMinutes: input.orderReservationMinutes,
        cardPendingReservationMinutes: input.cardPendingReservationMinutes
      }
    });
  }

  return prisma.companySettings.create({
    data: {
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
      defaultCurrency: input.defaultCurrency.toUpperCase(),
      platformFeeBps: Math.round(input.platformFeePercent * 100),
      orderReservationMinutes: input.orderReservationMinutes,
      cardPendingReservationMinutes: input.cardPendingReservationMinutes
    }
  });
}
