import { prisma } from "@/lib/prisma";

export type LeadEmailCampaignRecipientBreakdown = {
  acceptedCount: number;
  failedCount: number;
  pendingCount: number;
  processingCount: number;
  recipientCount: number;
};

export type LeadEmailCampaignReasonBreakdown = {
  message: string;
  count: number;
  status: "FAILED" | "SENT";
};

const FAILURE_EMAIL_STATUSES = new Set(["failed", "bounced", "complained", "suppressed"]);

export function isLeadEmailProviderFailureStatus(status: string) {
  return FAILURE_EMAIL_STATUSES.has(status);
}

export function translateLeadEmailProviderReason(message?: string | null) {
  const normalized = (message || "").toLowerCase();

  if (!normalized.trim()) {
    return "O provedor não informou o motivo da falha.";
  }

  if (normalized.includes("account-level suppression list") && normalized.includes("complaint")) {
    return "Entrega bloqueada pelo Resend porque este endereço entrou na lista de supressão por reclamação ou marcação como spam.";
  }

  if (normalized.includes("account-level suppression list")) {
    return "Entrega bloqueada pelo Resend porque este endereço está na lista de supressão da conta.";
  }

  if (normalized.includes("suppressed")) {
    return "Entrega bloqueada pela lista de supressão do provedor.";
  }

  if (normalized.includes("inbox was full") || normalized.includes("mailbox") || normalized.includes("caixa de entrada cheia")) {
    return "E-mail não entregue porque a caixa de entrada do destinatário estava cheia.";
  }

  if (normalized.includes("general bounce") || normalized.includes("bounce message") || normalized.includes("bounced")) {
    return "E-mail devolvido pelo provedor do destinatário.";
  }

  if (normalized.includes("complaint") || normalized.includes("complain") || normalized.includes("spam")) {
    return "Destinatário marcou o e-mail como spam ou reclamação.";
  }

  if (normalized.includes("delayed") || normalized.includes("atrasada")) {
    return "Entrega atrasada pelo provedor.";
  }

  if (normalized.includes("status final")) {
    return "O provedor não devolveu uma confirmação final para este e-mail.";
  }

  if (normalized.includes("invalid") || normalized.includes("invalido") || normalized.includes("inválido")) {
    return "E-mail inválido.";
  }

  if (normalized.includes("rate limit")) {
    return "Envio limitado temporariamente pelo provedor.";
  }

  return "Falha reportada pelo provedor de e-mail.";
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

export async function getLeadEmailCampaignReasonBreakdowns(campaignIds: string[]) {
  if (campaignIds.length === 0) {
    return new Map<string, LeadEmailCampaignReasonBreakdown[]>();
  }

  const groups = await prisma.leadEmailCampaignRecipient.groupBy({
    by: ["campaignId", "status", "errorMessage"],
    where: {
      campaignId: {
        in: campaignIds
      },
      errorMessage: {
        not: null
      },
      status: {
        in: ["FAILED", "SENT"]
      }
    },
    _count: {
      _all: true
    },
    orderBy: {
      _count: {
        errorMessage: "desc"
      }
    }
  });

  const breakdowns = new Map<string, LeadEmailCampaignReasonBreakdown[]>();

  for (const campaignId of campaignIds) {
    breakdowns.set(campaignId, []);
  }

  for (const group of groups) {
    if (!group.errorMessage || (group.status !== "FAILED" && group.status !== "SENT")) {
      continue;
    }

    breakdowns.get(group.campaignId)?.push({
      message: translateLeadEmailProviderReason(group.errorMessage),
      count: group._count._all,
      status: group.status
    });
  }

  return breakdowns;
}
