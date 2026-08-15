import { Prisma } from "@prisma/client";
import { sendLeadBroadcastEmailBatch } from "@/features/email/email.service";
import { translateLeadEmailProviderReason } from "@/features/leads/lead-email-campaign-metrics.service";
import { getOrganizationContextById } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { prisma } from "@/lib/prisma";
import { syncMarketingEmailCampaignCounts } from "./marketing-email.service";

const BATCH_SIZE = 100;
const REQUEST_SPACING_MS = 300;
const STALE_PROCESSING_WINDOW_MS = 10 * 60 * 1000;

type ClaimedMarketingRecipient = {
  id: string;
  email: string;
  name: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startCampaignIfQueued(campaignId: string) {
  const updated = await prisma.marketingEmailCampaign.updateMany({
    where: {
      id: campaignId,
      status: "QUEUED"
    },
    data: {
      completedAt: null,
      lastError: null,
      processingStartedAt: new Date(),
      status: "PROCESSING"
    }
  });

  return updated.count > 0;
}

async function recoverStaleProcessingRecipients(campaignId: string) {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_WINDOW_MS);

  return prisma.marketingEmailRecipient.updateMany({
    where: {
      campaignId,
      status: "PROCESSING",
      updatedAt: {
        lt: cutoff
      }
    },
    data: {
      errorMessage: null,
      status: "PENDING"
    }
  });
}

async function claimMarketingEmailRecipients(campaignId: string) {
  return prisma.$queryRaw<ClaimedMarketingRecipient[]>(Prisma.sql`
    WITH claimed AS (
      SELECT id
      FROM "MarketingEmailRecipient"
      WHERE "campaignId" = ${campaignId}
        AND "status" = CAST('PENDING' AS "MarketingEmailRecipientStatus")
        AND "emailOptOutAt" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "MarketingEmailRecipient" AS recipient
    SET
      "status" = CAST('PROCESSING' AS "MarketingEmailRecipientStatus"),
      "updatedAt" = NOW()
    FROM claimed
    WHERE recipient.id = claimed.id
    RETURNING recipient.id, recipient.email, recipient.name
  `);
}

export async function processMarketingEmailCampaignInBackground(campaignId: string) {
  const campaign = await prisma.marketingEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      subject: true,
      body: true,
      imageUrl: true,
      ctaLabel: true,
      destinationUrl: true,
      status: true
    }
  });

  if (!campaign) {
    return null;
  }

  if (campaign.status === "COMPLETED" || campaign.status === "COMPLETED_WITH_ERRORS") {
    return syncMarketingEmailCampaignCounts(campaign.id);
  }

  const startedNow = await startCampaignIfQueued(campaign.id);

  if (!startedNow && campaign.status !== "PROCESSING") {
    return syncMarketingEmailCampaignCounts(campaign.id);
  }

  if (!campaign.subject || !campaign.body || !campaign.destinationUrl) {
    await prisma.marketingEmailCampaign.update({
      where: {
        id: campaign.id
      },
      data: {
        completedAt: new Date(),
        lastError: "Preencha assunto, mensagem e link de destino antes de enviar.",
        status: "FAILED"
      }
    });

    return syncMarketingEmailCampaignCounts(campaign.id);
  }

  const organizationContext = await getOrganizationContextById(campaign.organizationId);
  const companySettings = await getCompanySettingsByOrganizationId(campaign.organizationId);

  while (true) {
    await recoverStaleProcessingRecipients(campaign.id);

    const recipients = await claimMarketingEmailRecipients(campaign.id);

    if (recipients.length === 0) {
      return syncMarketingEmailCampaignCounts(campaign.id);
    }

    try {
      const sendResult = await sendLeadBroadcastEmailBatch(
        recipients.map((recipient) => ({
          to: recipient.email,
          name: recipient.name,
          subject: campaign.subject!,
          body: campaign.body!,
          imageUrl: campaign.imageUrl,
          publicBaseUrl: organizationContext.publicBaseUrl,
          brandLogoUrl: organizationContext.brandLogoUrl,
          brandName: organizationContext.brandName,
          brandPrimaryColor: organizationContext.organization.primaryColor,
          organization: organizationContext.organization,
          eventTitle: campaign.name,
          ctaLabel: campaign.ctaLabel || "Abrir link",
          ctaUrl: `${organizationContext.publicBaseUrl}/r/marketing-email/${campaign.id}/${recipient.id}`,
          openTrackingUrl: `${organizationContext.publicBaseUrl}/r/marketing-email-open/${campaign.id}/${recipient.id}`,
          unsubscribeUrl: `${organizationContext.publicBaseUrl}/r/marketing-email-unsubscribe/${campaign.id}/${recipient.id}`,
          supportEmail: companySettings.supportEmail
        }))
      );

      const sentIndexes = new Set(sendResult.sent.map((entry) => entry.index));
      const failedIndexes = new Set(sendResult.failed.map((entry) => entry.index));
      const updates = [];

      for (const sent of sendResult.sent) {
        const recipient = recipients[sent.index];

        updates.push(
          prisma.marketingEmailRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              errorMessage: null,
              providerMessageId: sent.id,
              sentAt: new Date(),
              status: "SENT"
            }
          })
        );
      }

      for (const failed of sendResult.failed) {
        const recipient = recipients[failed.index];

        updates.push(
          prisma.marketingEmailRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              errorMessage: translateLeadEmailProviderReason(failed.message),
              status: "FAILED"
            }
          })
        );
      }

      for (let index = 0; index < recipients.length; index += 1) {
        if (sentIndexes.has(index) || failedIndexes.has(index)) {
          continue;
        }

        updates.push(
          prisma.marketingEmailRecipient.update({
            where: {
              id: recipients[index].id
            },
            data: {
              errorMessage: "O provedor não devolveu um status final para este e-mail.",
              status: "FAILED"
            }
          })
        );
      }

      await prisma.$transaction(updates);
      await syncMarketingEmailCampaignCounts(campaign.id);
    } catch (error) {
      const message = translateLeadEmailProviderReason(error instanceof Error ? error.message : "Falha ao processar campanha.");

      await prisma.$transaction([
        ...recipients.map((recipient) =>
          prisma.marketingEmailRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              errorMessage: message,
              status: "FAILED"
            }
          })
        ),
        prisma.marketingEmailCampaign.update({
          where: {
            id: campaign.id
          },
          data: {
            lastError: message
          }
        })
      ]);
      await syncMarketingEmailCampaignCounts(campaign.id);
    }

    await sleep(REQUEST_SPACING_MS);
  }
}
