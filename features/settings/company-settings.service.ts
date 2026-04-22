import { ensureDefaultOrganizationBackfill } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import type { CompanySettingsInput } from "./company-settings.schema";

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
      defaultCurrency: "BRL",
      platformFeeBps: 0,
      orderReservationMinutes: 120,
      cardPendingReservationMinutes: 30
    }
  });
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
      defaultCurrency: input.defaultCurrency.toUpperCase(),
      platformFeeBps: Math.round(input.platformFeePercent * 100),
      orderReservationMinutes: input.orderReservationMinutes,
      cardPendingReservationMinutes: input.cardPendingReservationMinutes
    }
  });
}
