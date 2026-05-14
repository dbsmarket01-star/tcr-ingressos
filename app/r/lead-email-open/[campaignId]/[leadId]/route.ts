import { NextResponse } from "next/server";
import { isLikelyAutomatedEmailCheck } from "@/features/leads/lead-email-tracking.service";
import { prisma } from "@/lib/prisma";

const PIXEL_BYTES = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0,
  255, 255, 255, 33, 249, 4, 1, 0, 0, 1, 0, 44, 0, 0, 0, 0,
  1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string; leadId: string }> }
) {
  const { campaignId, leadId } = await params;

  if (!isLikelyAutomatedEmailCheck(request)) {
    try {
      await prisma.leadEmailCampaignOpen.create({
        data: {
          campaignId,
          leadId
        }
      });
    } catch {
      // Ignore duplicate open records for the same lead/campaign.
    }
  }

  return new NextResponse(PIXEL_BYTES, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
