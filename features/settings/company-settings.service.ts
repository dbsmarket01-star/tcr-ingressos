import { prisma } from "@/lib/prisma";
import type { CompanySettingsInput } from "./company-settings.schema";

export const COMPANY_SETTINGS_ID = "tcr-company-settings";

export async function getCompanySettings() {
  const settings = await prisma.companySettings.findUnique({
    where: {
      id: COMPANY_SETTINGS_ID
    }
  });

  if (settings) {
    return settings;
  }

  return prisma.companySettings.create({
    data: {
      id: COMPANY_SETTINGS_ID,
      companyName: "TCR Ingressos",
      tradeName: "TCR Ingressos",
      document: "00.000.000/0001-00",
      supportEmail: "contato@tcringressos.com.br",
      supportPhone: null,
      defaultCurrency: "BRL",
      platformFeeBps: 0
    }
  });
}

export async function updateCompanySettings(input: CompanySettingsInput) {
  return prisma.companySettings.upsert({
    where: {
      id: COMPANY_SETTINGS_ID
    },
    update: {
      companyName: input.companyName,
      tradeName: input.tradeName,
      document: input.document,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone || null,
      defaultCurrency: input.defaultCurrency.toUpperCase(),
      platformFeeBps: Math.round(input.platformFeePercent * 100)
    },
    create: {
      id: COMPANY_SETTINGS_ID,
      companyName: input.companyName,
      tradeName: input.tradeName,
      document: input.document,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone || null,
      defaultCurrency: input.defaultCurrency.toUpperCase(),
      platformFeeBps: Math.round(input.platformFeePercent * 100)
    }
  });
}
