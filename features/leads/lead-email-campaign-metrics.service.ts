import { prisma } from "@/lib/prisma";

export type LeadEmailCampaignRecipientBreakdown = {
  acceptedCount: number;
  failedCount: number;
  pendingCount: number;
  processingCount: number;
  recipientCount: number;
};

const FAILURE_EMAIL_STATUSES = new Set(["failed", "bounced", "complained", "suppressed"]);

export function isLeadEmailProviderFailureStatus(status: string) {
  return FAILURE_EMAIL_STATUSES.has(status);
}

export async function getLeadEmailCampaignRecipientBreakdowns(campaignIds: string[]) {
  if (campaignIds.length === 0) {
    return new Map<string, LeadEmailCampaignRecipientBreakdown>();
  }

  const groups = await prisma.leadEmailCampaignRecipient.groupBy({
    by: ["campaignId", "status"],
    where: {
      campaignId: {
        in: campaignIds
      }
    },
    _count: {
      _all: true
    }
  });

  const breakdowns = new Map<string, LeadEmailCampaignRecipientBreakdown>();

  for (const campaignId of campaignIds) {
    breakdowns.set(campaignId, {
      acceptedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      processingCount: 0,
      recipientCount: 0
    });
  }

  for (const group of groups) {
    const breakdown = breakdowns.get(group.campaignId);

    if (!breakdown) {
      continue;
    }

    const count = group._count._all;
    breakdown.recipientCount += count;

    if (group.status === "SENT") {
      breakdown.acceptedCount += count;
    } else if (group.status === "FAILED") {
      breakdown.failedCount += count;
    } else if (group.status === "PROCESSING") {
      breakdown.processingCount += count;
    } else {
      breakdown.pendingCount += count;
    }
  }

  return breakdowns;
}

export async function syncLeadEmailCampaignCounts(campaignId: string) {
  const breakdowns = await getLeadEmailCampaignRecipientBreakdowns([campaignId]);
  const breakdown = breakdowns.get(campaignId);

  if (!breakdown || breakdown.recipientCount === 0) {
    return null;
  }

  const activeCount = breakdown.pendingCount + breakdown.processingCount;
  const campaign = await prisma.leadEmailCampaign.findUnique({
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
      : breakdown.failedCount > 0
        ? "COMPLETED_WITH_ERRORS"
        : "COMPLETED";

  return prisma.leadEmailCampaign.update({
    where: {
      id: campaignId
    },
    data: {
      totalCount: breakdown.recipientCount,
      sentCount: breakdown.acceptedCount,
      failedCount: breakdown.failedCount,
      status,
      completedAt: activeCount > 0 ? null : campaign.completedAt ?? new Date()
    }
  });
}
