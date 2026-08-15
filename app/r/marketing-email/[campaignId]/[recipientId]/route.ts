import { NextResponse } from "next/server";
import { isLikelyAutomatedEmailCheck } from "@/features/leads/lead-email-tracking.service";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string; recipientId: string }> }
) {
  const { campaignId, recipientId } = await params;
  const campaign = await prisma.marketingEmailCampaign.findUnique({
    where: {
      id: campaignId
    },
    select: {
      destinationUrl: true
    }
  });

  if (!campaign?.destinationUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isLikelyAutomatedEmailCheck(request)) {
    await prisma.marketingEmailCampaignClick
      .create({
        data: {
          campaignId,
          recipientId
        }
      })
      .catch(() => null);
  }

  return NextResponse.redirect(campaign.destinationUrl);
}
