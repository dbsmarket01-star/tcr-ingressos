import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessEvent, requirePermission } from "@/features/auth/auth.service";
import { sendLeadBroadcastEmailBatch } from "@/features/email/email.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";

const BATCH_SIZE = 100;

function summarizeCampaign(campaign: {
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
}) {
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const admin = await requirePermission("EVENTS");
  const { campaignId } = await params;
  const organizationContext = await getCurrentOrganizationContext();

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
      totalCount: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      processingStartedAt: true,
      completedAt: true,
      lastError: true,
      event: {
        select: {
          id: true,
          title: true,
          organizationId: true
        }
      }
    }
  });

  if (
    !campaign ||
    campaign.event.organizationId !== admin.organizationId ||
    !canAccessEvent(admin, campaign.eventId)
  ) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  if (campaign.status === "COMPLETED" || campaign.status === "COMPLETED_WITH_ERRORS" || campaign.status === "FAILED") {
    return NextResponse.json({ campaign: summarizeCampaign(campaign) });
  }

  const companySettings = await getCompanySettingsByOrganizationId(admin.organizationId!);

  await prisma.leadEmailCampaign.update({
    where: {
      id: campaign.id
    },
    data: {
      status: "PROCESSING",
      processingStartedAt: campaign.processingStartedAt ?? new Date(),
      lastError: null
    }
  });

  const recipients = await prisma.leadEmailCampaignRecipient.findMany({
    where: {
      campaignId: campaign.id,
      status: "PENDING"
    },
    orderBy: {
      createdAt: "asc"
    },
    take: BATCH_SIZE,
    select: {
      id: true,
      leadId: true,
      email: true,
      name: true
    }
  });

  if (recipients.length === 0) {
    const finalizedCampaign = await prisma.leadEmailCampaign.update({
      where: {
        id: campaign.id
      },
      data: {
        status: campaign.failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        completedAt: campaign.completedAt ?? new Date()
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

    return NextResponse.json({ campaign: summarizeCampaign(finalizedCampaign) });
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
        instagramUrl: campaign.instagramUrl,
        supportEmail: companySettings.supportEmail
      }))
    );

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
            increment: sendResult.failed.length
          },
          lastError: sendResult.failed[0]?.message ?? null
        }
      })
    );

    await prisma.$transaction(updates);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar campanha.";

    const failedCampaign = await prisma.leadEmailCampaign.update({
      where: {
        id: campaign.id
      },
      data: {
        lastError: message
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

    return NextResponse.json({ campaign: summarizeCampaign(failedCampaign), error: message }, { status: 500 });
  }

  const pendingCount = await prisma.leadEmailCampaignRecipient.count({
    where: {
      campaignId: campaign.id,
      status: "PENDING"
    }
  });
  const latestCounts = await prisma.leadEmailCampaign.findUnique({
    where: {
      id: campaign.id
    },
    select: {
      failedCount: true
    }
  });

  const refreshedCampaign = await prisma.leadEmailCampaign.update({
    where: {
      id: campaign.id
    },
    data:
      pendingCount === 0
        ? {
            status: (latestCounts?.failedCount ?? 0) > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
            completedAt: new Date()
          }
        : {
            status: "PROCESSING"
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

  return NextResponse.json({ campaign: summarizeCampaign(refreshedCampaign) });
}
