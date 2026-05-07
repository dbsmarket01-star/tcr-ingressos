import { after, NextResponse } from "next/server";
import { canAccessEvent, requirePermission } from "@/features/auth/auth.service";
import {
  getLeadEmailCampaignSnapshot,
  processLeadEmailCampaignInBackground,
  summarizeLeadEmailCampaign
} from "@/features/leads/lead-email-campaign-processor.service";
import { prisma } from "@/lib/prisma";

async function loadAuthorizedCampaign(campaignId: string, organizationId: string) {
  return prisma.leadEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      id: true,
      eventId: true,
      status: true,
      event: {
        select: {
          organizationId: true
        }
      }
    }
  }).then((campaign) => {
    if (!campaign || campaign.event.organizationId !== organizationId) {
      return null;
    }

    return campaign;
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const admin = await requirePermission("EVENTS");
  const { campaignId } = await params;
  const campaign = await loadAuthorizedCampaign(campaignId, admin.organizationId!);

  if (!campaign || !canAccessEvent(admin, campaign.eventId)) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  const snapshot = await getLeadEmailCampaignSnapshot(campaignId);

  if (!snapshot) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ campaign: summarizeLeadEmailCampaign(snapshot) });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const admin = await requirePermission("EVENTS");
  const { campaignId } = await params;
  const campaign = await loadAuthorizedCampaign(campaignId, admin.organizationId!);

  if (!campaign || !canAccessEvent(admin, campaign.eventId)) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  if (campaign.status === "QUEUED") {
    after(async () => {
      await processLeadEmailCampaignInBackground(campaignId);
    });
  }

  const snapshot = await getLeadEmailCampaignSnapshot(campaignId);

  if (!snapshot) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ campaign: summarizeLeadEmailCampaign(snapshot) });
}
