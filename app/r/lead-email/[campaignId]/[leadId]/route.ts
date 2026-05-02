import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string; leadId: string }> }
) {
  const { campaignId, leadId } = await params;

  const campaign = await prisma.leadEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      destinationUrl: true
    }
  });

  if (!campaign?.destinationUrl) {
    return NextResponse.redirect(new URL("/", _request.url));
  }

  try {
    await prisma.leadEmailCampaignClick.create({
      data: {
        campaignId,
        leadId
      }
    });
  } catch {
    // Ignore duplicate click records for the same lead/campaign.
  }

  return NextResponse.redirect(campaign.destinationUrl);
}
