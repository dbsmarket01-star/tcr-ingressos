"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/auth.service";
import { sendLeadBroadcastEmail } from "@/features/email/email.service";
import { getOrganizationContextById } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { prisma } from "@/lib/prisma";
import {
  parseMarketingEmailContactList,
  readMarketingEmailImportFile
} from "./contact-list-parser";
import { processMarketingEmailCampaignInBackground } from "./marketing-email-processor.service";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDestinationUrl(value: string) {
  const text = value.trim();

  if (!text) {
    return null;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (text.startsWith("www.")) {
    return `https://${text}`;
  }

  return `https://${text}`;
}

function marketingEmailUrl(campaignId?: string, params?: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();

  if (campaignId) {
    search.set("campaignId", campaignId);
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  const query = search.toString();

  return `/admin/marketing/email/campaigns${query ? `?${query}` : ""}`;
}

async function requireOwnedCampaign(campaignId: string, organizationId: string) {
  return prisma.marketingEmailCampaign.findFirst({
    where: {
      id: campaignId,
      organizationId
    }
  });
}

export async function createMarketingEmailCampaignAction(formData: FormData) {
  const admin = await requirePermission("MARKETING");
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 3) {
    redirect(marketingEmailUrl(undefined, { error: "Dê um nome para a campanha antes de continuar." }));
  }

  const campaign = await prisma.marketingEmailCampaign.create({
    data: {
      createdById: admin.id,
      name,
      organizationId: admin.organizationId
    }
  });

  redirect(marketingEmailUrl(campaign.id, { created: 1 }));
}

export async function importMarketingEmailContactsAction(formData: FormData) {
  const admin = await requirePermission("MARKETING");
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const pastedList = String(formData.get("contactListText") ?? "").trim();
  const file = formData.get("contactListFile");

  if (!campaignId) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não informada." }));
  }

  const campaign = await requireOwnedCampaign(campaignId, admin.organizationId);

  if (!campaign) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não encontrada para esta bilheteria." }));
  }

  if (campaign.status === "PROCESSING" || campaign.status === "QUEUED") {
    redirect(marketingEmailUrl(campaign.id, { error: "Aguarde o disparo atual terminar antes de trocar a lista." }));
  }

  const fileText = await readMarketingEmailImportFile(file);
  const rawText = [pastedList, fileText].filter(Boolean).join("\n");

  if (!rawText.trim()) {
    redirect(marketingEmailUrl(campaign.id, { error: "Cole os contatos ou selecione um arquivo CSV para importar." }));
  }

  const summary = parseMarketingEmailContactList(rawText);

  if (summary.contacts.length === 0) {
    redirect(marketingEmailUrl(campaign.id, {
      error: "Nenhum e-mail válido foi encontrado na lista enviada.",
      importInvalid: summary.invalidEmails,
      importTotal: summary.totalRows
    }));
  }

  if (summary.contacts.length > 10000) {
    redirect(marketingEmailUrl(campaign.id, { error: "Importe no máximo 10.000 contatos por campanha." }));
  }

  await prisma.$transaction([
    prisma.marketingEmailCampaignClick.deleteMany({
      where: {
        campaignId: campaign.id
      }
    }),
    prisma.marketingEmailCampaignOpen.deleteMany({
      where: {
        campaignId: campaign.id
      }
    }),
    prisma.marketingEmailRecipient.deleteMany({
      where: {
        campaignId: campaign.id
      }
    }),
    prisma.marketingEmailRecipient.createMany({
      data: summary.contacts.map((contact) => ({
        campaignId: campaign.id,
        email: contact.email,
        name: contact.name,
        phone: contact.phone
      }))
    }),
    prisma.marketingEmailCampaign.update({
      where: {
        id: campaign.id
      },
      data: {
        failedCount: 0,
        importDuplicates: summary.duplicates,
        importIgnored: summary.ignored,
        importInvalidEmails: summary.invalidEmails,
        importRecognized: summary.recognized,
        importTotalRows: summary.totalRows,
        importedAt: new Date(),
        lastError: null,
        processingStartedAt: null,
        sentCount: 0,
        status: campaign.subject && campaign.body && campaign.destinationUrl ? "READY" : "DRAFT",
        totalCount: summary.recognized
      }
    })
  ]);

  redirect(marketingEmailUrl(campaign.id, {
    imported: 1,
    importDuplicates: summary.duplicates,
    importIgnored: summary.ignored,
    importInvalid: summary.invalidEmails,
    importRecognized: summary.recognized,
    importTotal: summary.totalRows
  }));
}

export async function saveMarketingEmailContentAction(formData: FormData) {
  const admin = await requirePermission("MARKETING");
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const destinationUrl = normalizeDestinationUrl(String(formData.get("destinationUrl") ?? ""));

  if (!campaignId) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não informada." }));
  }

  const campaign = await requireOwnedCampaign(campaignId, admin.organizationId);

  if (!campaign) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não encontrada para esta bilheteria." }));
  }

  if (subject.length < 4 || body.length < 12) {
    redirect(marketingEmailUrl(campaign.id, { error: "Preencha assunto e mensagem com um conteúdo mais completo." }));
  }

  if (!destinationUrl) {
    redirect(marketingEmailUrl(campaign.id, { error: "Informe um link de destino válido para o botão do e-mail." }));
  }

  let imageUrl = campaign.imageUrl;

  try {
    const uploadedImageUrl = await savePublicImageUpload(
      formData.get("imageFile") as File | null,
      `marketing-email/${campaign.id}`
    );

    imageUrl = uploadedImageUrl ?? imageUrl;
  } catch (error) {
    redirect(marketingEmailUrl(campaign.id, {
      error: getFriendlyErrorMessage(error, "Não foi possível salvar a imagem do e-mail.")
    }));
  }

  const recipientCount = await prisma.marketingEmailRecipient.count({
    where: {
      campaignId: campaign.id
    }
  });

  await prisma.marketingEmailCampaign.update({
    where: {
      id: campaign.id
    },
    data: {
      body,
      ctaLabel: ctaLabel || null,
      destinationUrl,
      imageUrl,
      lastError: null,
      status: recipientCount > 0 ? "READY" : "DRAFT",
      subject
    }
  });

  redirect(marketingEmailUrl(campaign.id, { contentSaved: 1 }));
}

export async function sendMarketingEmailTestAction(formData: FormData) {
  const admin = await requirePermission("MARKETING");
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const testEmail = normalizeEmail(String(formData.get("testEmail") ?? ""));

  if (!campaignId) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não informada." }));
  }

  const campaign = await requireOwnedCampaign(campaignId, admin.organizationId);

  if (!campaign) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não encontrada para esta bilheteria." }));
  }

  if (!isValidEmail(testEmail)) {
    redirect(marketingEmailUrl(campaign.id, { error: "Informe um e-mail de teste válido." }));
  }

  if (!campaign.subject || !campaign.body || !campaign.destinationUrl) {
    redirect(marketingEmailUrl(campaign.id, { error: "Salve assunto, mensagem e link antes de enviar o teste." }));
  }

  const [organizationContext, companySettings] = await Promise.all([
    getOrganizationContextById(admin.organizationId),
    getCompanySettingsByOrganizationId(admin.organizationId)
  ]);

  try {
    await sendLeadBroadcastEmail({
      to: testEmail,
      name: "Teste",
      subject: campaign.subject,
      body: campaign.body,
      imageUrl: campaign.imageUrl,
      publicBaseUrl: organizationContext.publicBaseUrl,
      brandLogoUrl: organizationContext.brandLogoUrl,
      brandName: organizationContext.brandName,
      brandPrimaryColor: organizationContext.organization.primaryColor,
      organization: organizationContext.organization,
      eventTitle: campaign.name,
      ctaLabel: campaign.ctaLabel || "Abrir link",
      ctaUrl: campaign.destinationUrl,
      supportEmail: companySettings.supportEmail
    });
  } catch (error) {
    redirect(marketingEmailUrl(campaign.id, {
      error: getFriendlyErrorMessage(error, "Não foi possível enviar o teste agora.")
    }));
  }

  redirect(marketingEmailUrl(campaign.id, { testSent: testEmail }));
}

export async function sendMarketingEmailCampaignAction(formData: FormData) {
  const admin = await requirePermission("MARKETING");
  const campaignId = String(formData.get("campaignId") ?? "").trim();

  if (!campaignId) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não informada." }));
  }

  const campaign = await requireOwnedCampaign(campaignId, admin.organizationId);

  if (!campaign) {
    redirect(marketingEmailUrl(undefined, { error: "Campanha não encontrada para esta bilheteria." }));
  }

  if (!campaign.subject || !campaign.body || !campaign.destinationUrl) {
    redirect(marketingEmailUrl(campaign.id, { error: "Salve o conteúdo do e-mail antes de enviar a campanha." }));
  }

  if (campaign.status === "QUEUED" || campaign.status === "PROCESSING") {
    redirect(marketingEmailUrl(campaign.id, { error: "Esta campanha já está em envio." }));
  }

  const recipientCount = await prisma.marketingEmailRecipient.count({
    where: {
      campaignId: campaign.id,
      emailOptOutAt: null
    }
  });

  if (recipientCount === 0) {
    redirect(marketingEmailUrl(campaign.id, { error: "Importe uma lista com e-mails válidos antes de enviar." }));
  }

  await prisma.$transaction([
    prisma.marketingEmailRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        status: {
          in: ["FAILED", "PROCESSING", "SENT"]
        }
      },
      data: {
        errorMessage: null,
        providerMessageId: null,
        sentAt: null,
        status: "PENDING"
      }
    }),
    prisma.marketingEmailCampaignClick.deleteMany({
      where: {
        campaignId: campaign.id
      }
    }),
    prisma.marketingEmailCampaignOpen.deleteMany({
      where: {
        campaignId: campaign.id
      }
    }),
    prisma.marketingEmailCampaign.update({
      where: {
        id: campaign.id
      },
      data: {
        completedAt: null,
        failedCount: 0,
        lastError: null,
        processingStartedAt: null,
        sentCount: 0,
        status: "QUEUED",
        totalCount: recipientCount
      }
    })
  ]);

  after(async () => {
    try {
      await processMarketingEmailCampaignInBackground(campaign.id);
    } catch (error) {
      await prisma.marketingEmailCampaign.updateMany({
        where: {
          id: campaign.id,
          status: {
            in: ["QUEUED", "PROCESSING"]
          }
        },
        data: {
          completedAt: new Date(),
          lastError: getFriendlyErrorMessage(error, "Falha ao processar disparo de e-mail."),
          status: "FAILED"
        }
      });
    }
  });

  redirect(marketingEmailUrl(campaign.id, { queued: 1 }));
}
