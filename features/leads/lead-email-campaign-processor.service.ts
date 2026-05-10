import { Prisma } from "@prisma/client";
import { sendLeadBroadcastEmailBatch } from "@/features/email/email.service";
import { getOrganizationContextById } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 100;
const REQUEST_SPACING_MS = 300;

type CampaignSnapshot = {
  id: string;
  subject: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
};

type ClaimedRecipientRow = {
  id: string;
  leadId: string;
  email: string;
  name: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function summarizeLeadEmailCampaign(campaign: CampaignSnapshot) {
  return {
    id: campaign.id,
    subject: campaign.subject,
    status: campaign.status,
    totalCount: campaign.totalCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    pendingCount: Math.max(campaign.totalCount - campaign.sentCount - campaign.failedCount, 0),
    createdAt: campaign.createdAt.toISOString(),
    processingStartedAt: campaign.processingStartedAt?.toISOString() ?? null,
    completedAt: campaign.completedAt?.toISOString() ?? null,
    lastError: campaign.lastError
  };
}

export async function getLeadEmailCampaignSnapshot(campaignId: string) {
  return prisma.leadEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      id: true,
      subject: true,
      status: true,
      totalCount: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      processingStartedAt: true,
      completedAt: true,
      lastError: true
    }
  });
}

async function claimLeadEmailCampaignRecipients(campaignId: string, batchSize: number) {
  return prisma.$queryRaw<ClaimedRecipientRow[]>(Prisma.sql`
    WITH claimed AS (
      SELECT id
      FROM "LeadEmailCampaignRecipient"
      WHERE "campaignId" = ${campaignId}
        AND "status" = CAST('PENDING' AS "LeadEmailCampaignRecipientStatus")
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "LeadEmailCampaignRecipient" AS recipient
    SET
      "status" = CAST('PROCESSING' AS "LeadEmailCampaignRecipientStatus"),
      "updatedAt" = NOW()
    FROM claimed
    WHERE recipient.id = claimed.id
    RETURNING recipient.id, recipient."leadId", recipient.email, recipient.name
  `);
}

async function finalizeLeadEmailCampaign(campaignId: string) {
  const latest = await prisma.leadEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      id: true,
      subject: true,
      totalCount: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      processingStartedAt: true,
      completedAt: true,
      lastError: true
    }
  });

  if (!latest) {
    return null;
  }

  return prisma.leadEmailCampaign.update({
    where: {
      id: campaignId
    },
    data: {
      status: latest.failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      completedAt: new Date()
    },
    select: {
      id: true,
      subject: true,
      status: true,
      totalCount: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      processingStartedAt: true,
      completedAt: true,
      lastError: true
    }
  });
}

async function startCampaignIfQueued(campaignId: string) {
  const updated = await prisma.leadEmailCampaign.updateMany({
    where: {
      id: campaignId,
      status: "QUEUED"
    },
    data: {
      status: "PROCESSING",
      processingStartedAt: new Date(),
      completedAt: null,
      lastError: null
    }
  });

  return updated.count > 0;
}

export async function processLeadEmailCampaignInBackground(campaignId: string) {
  const campaign = await prisma.leadEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      id: true,
      eventId: true,
      subject: true,
      body: true,
      imageUrl: true,
      imageCrop: true,
      imageWidth: true,
      imageHeight: true,
      ctaLabel: true,
      destinationUrl: true,
      instagramUrl: true,
      status: true,
      event: {
        select: {
          title: true,
          organizationId: true
        }
      }
    }
  });

  if (!campaign) {
    return null;
  }

  if (campaign.status === "COMPLETED" || campaign.status === "COMPLETED_WITH_ERRORS") {
    return getLeadEmailCampaignSnapshot(campaign.id);
  }

  const startedNow = await startCampaignIfQueued(campaign.id);

  if (!startedNow && campaign.status !== "PROCESSING") {
    return getLeadEmailCampaignSnapshot(campaign.id);
  }

  const organizationId = campaign.event.organizationId;

  if (!organizationId) {
    await prisma.leadEmailCampaign.update({
      where: {
        id: campaign.id
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        lastError: "Campanha sem organização associada."
      }
    });

    return getLeadEmailCampaignSnapshot(campaign.id);
  }

  const organizationContext = await getOrganizationContextById(organizationId);
  const companySettings = await getCompanySettingsByOrganizationId(organizationId);

  while (true) {
    const recipients = await claimLeadEmailCampaignRecipients(campaign.id, BATCH_SIZE);

    if (recipients.length === 0) {
      return finalizeLeadEmailCampaign(campaign.id);
    }

    try {
      const sendResult = await sendLeadBroadcastEmailBatch(
        recipients.map((recipient) => ({
          to: recipient.email,
          name: recipient.name,
          subject: campaign.subject,
          body: campaign.body,
          imageUrl: campaign.imageUrl,
          imageCrop: campaign.imageCrop,
          imageWidth: campaign.imageWidth,
          imageHeight: campaign.imageHeight,
          publicBaseUrl: organizationContext.publicBaseUrl,
          brandLogoUrl: organizationContext.brandLogoUrl,
          brandName: organizationContext.brandName,
          eventTitle: campaign.event.title,
          ctaLabel: campaign.ctaLabel || "Abrir link",
          ctaUrl: `${organizationContext.publicBaseUrl}/r/lead-email/${campaign.id}/${recipient.leadId}`,
          openTrackingUrl: `${organizationContext.publicBaseUrl}/r/lead-email-open/${campaign.id}/${recipient.leadId}`,
          unsubscribeUrl: `${organizationContext.publicBaseUrl}/r/lead-email-unsubscribe/${campaign.id}/${recipient.leadId}`,
          instagramUrl: campaign.instagramUrl,
          supportEmail: companySettings.supportEmail
        }))
      );

      const sentIndexes = new Set(sendResult.sent.map((entry) => entry.index));
      const failedIndexes = new Set(sendResult.failed.map((entry) => entry.index));
      const unaccountedIndexes: number[] = [];

      for (let index = 0; index < recipients.length; index += 1) {
        if (!sentIndexes.has(index) && !failedIndexes.has(index)) {
          unaccountedIndexes.push(index);
        }
      }

      const updates = [];

      for (const sent of sendResult.sent) {
        const recipient = recipients[sent.index];

        updates.push(
          prisma.leadEmailCampaignRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              status: "SENT",
              providerMessageId: sent.id,
              sentAt: new Date(),
              errorMessage: null
            }
          })
        );
      }

      for (const failed of sendResult.failed) {
        const recipient = recipients[failed.index];

        updates.push(
          prisma.leadEmailCampaignRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              status: "FAILED",
              errorMessage: failed.message
            }
          })
        );
      }

      for (const index of unaccountedIndexes) {
        const recipient = recipients[index];

        updates.push(
          prisma.leadEmailCampaignRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              status: "FAILED",
              errorMessage: "O provedor não devolveu um status final para este e-mail."
            }
          })
        );
      }

      const failedTotal = sendResult.failed.length + unaccountedIndexes.length;

      updates.push(
        prisma.leadEmailCampaign.update({
          where: {
            id: campaign.id
          },
          data: {
            sentCount: {
              increment: sendResult.sent.length
            },
            failedCount: {
              increment: failedTotal
            },
            lastError:
              sendResult.failed[0]?.message ||
              (unaccountedIndexes.length > 0
                ? "Alguns destinatários não retornaram status final do provedor."
                : null)
          }
        })
      );

      await prisma.$transaction(updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar campanha.";

      await prisma.$transaction([
        ...recipients.map((recipient) =>
          prisma.leadEmailCampaignRecipient.update({
            where: {
              id: recipient.id
            },
            data: {
              status: "FAILED",
              errorMessage: message
            }
          })
        ),
        prisma.leadEmailCampaign.update({
          where: {
            id: campaign.id
          },
          data: {
            failedCount: {
              increment: recipients.length
            },
            lastError: message
          }
        })
      ]);
    }

    await sleep(REQUEST_SPACING_MS);
  }
}
