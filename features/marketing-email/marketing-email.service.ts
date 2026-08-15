import { MarketingEmailCampaignStatus, MarketingEmailRecipientStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MarketingEmailCampaignWithMetrics = Awaited<ReturnType<typeof getMarketingEmailCampaigns>>[number];

function getRecipientCounts(recipients: Array<{ status: MarketingEmailRecipientStatus }>) {
  return recipients.reduce(
    (totals, recipient) => {
      if (recipient.status === "SENT") {
        totals.sent += 1;
      } else if (recipient.status === "FAILED") {
        totals.failed += 1;
      } else if (recipient.status === "PROCESSING") {
        totals.processing += 1;
      } else if (recipient.status === "UNSUBSCRIBED") {
        totals.unsubscribed += 1;
      } else {
        totals.pending += 1;
      }

      return totals;
    },
    {
      failed: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      unsubscribed: 0
    }
  );
}

export function getMarketingEmailStatusLabel(status: MarketingEmailCampaignStatus) {
  const labels: Record<MarketingEmailCampaignStatus, string> = {
    COMPLETED: "Concluída",
    COMPLETED_WITH_ERRORS: "Concluída com falhas",
    DRAFT: "Rascunho",
    FAILED: "Falhou",
    PROCESSING: "Enviando",
    QUEUED: "Na fila",
    READY: "Pronta"
  };

  return labels[status];
}

export async function syncMarketingEmailCampaignCounts(campaignId: string) {
  const [recipientGroups, opens, clicks] = await Promise.all([
    prisma.marketingEmailRecipient.groupBy({
      by: ["status"],
      where: {
        campaignId
      },
      _count: {
        _all: true
      }
    }),
    prisma.marketingEmailCampaignOpen.count({
      where: {
        campaignId
      }
    }),
    prisma.marketingEmailCampaignClick.count({
      where: {
        campaignId
      }
    })
  ]);
  const counts = recipientGroups.reduce(
    (totals, group) => {
      const count = group._count._all;

      if (group.status === "SENT") {
        totals.sent += count;
      } else if (group.status === "FAILED") {
        totals.failed += count;
      } else if (group.status === "PROCESSING") {
        totals.processing += count;
      } else if (group.status === "UNSUBSCRIBED") {
        totals.unsubscribed += count;
      } else {
        totals.pending += count;
      }

      return totals;
    },
    {
      failed: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      unsubscribed: 0
    }
  );
  const activeCount = counts.pending + counts.processing;
  const campaign = await prisma.marketingEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      status: true,
      completedAt: true
    }
  });

  if (!campaign) {
    return null;
  }

  const status =
    activeCount > 0
      ? campaign.status === "QUEUED"
        ? "QUEUED"
        : "PROCESSING"
      : counts.failed > 0
        ? "COMPLETED_WITH_ERRORS"
        : counts.sent > 0 || counts.unsubscribed > 0
          ? "COMPLETED"
          : campaign.status;

  return prisma.marketingEmailCampaign.update({
    where: {
      id: campaignId
    },
    data: {
      failedCount: counts.failed,
      sentCount: counts.sent,
      status,
      totalCount: counts.pending + counts.processing + counts.sent + counts.failed + counts.unsubscribed,
      completedAt: activeCount > 0 ? null : campaign.completedAt ?? new Date()
    },
    select: {
      id: true,
      status: true,
      sentCount: true,
      failedCount: true,
      totalCount: true
    }
  });
}

export async function getMarketingEmailCampaigns(organizationId: string) {
  const campaigns = await prisma.marketingEmailCampaign.findMany({
    where: {
      organizationId
    },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      recipients: {
        select: {
          status: true
        }
      },
      _count: {
        select: {
          clicks: true,
          opens: true,
          recipients: true
        }
      }
    },
    take: 30
  });

  return campaigns.map((campaign) => {
    const counts = getRecipientCounts(campaign.recipients);

    return {
      ...campaign,
      metrics: {
        clicks: campaign._count.clicks,
        failed: counts.failed,
        opens: campaign._count.opens,
        pending: counts.pending,
        processing: counts.processing,
        recipients: campaign._count.recipients,
        sent: counts.sent,
        unsubscribed: counts.unsubscribed
      },
      recipients: undefined
    };
  });
}

export async function getMarketingEmailCampaign(organizationId: string, campaignId: string) {
  const campaign = await prisma.marketingEmailCampaign.findFirst({
    where: {
      id: campaignId,
      organizationId
    },
    include: {
      recipients: {
        orderBy: {
          createdAt: "asc"
        },
        take: 25
      },
      _count: {
        select: {
          clicks: true,
          opens: true,
          recipients: true
        }
      }
    }
  });

  if (!campaign) {
    return null;
  }

  const counts = getRecipientCounts(campaign.recipients);

  return {
    ...campaign,
    metrics: {
      clicks: campaign._count.clicks,
      failed: counts.failed,
      opens: campaign._count.opens,
      pending: counts.pending,
      processing: counts.processing,
      recipients: campaign._count.recipients,
      sent: counts.sent,
      unsubscribed: counts.unsubscribed
    }
  };
}
