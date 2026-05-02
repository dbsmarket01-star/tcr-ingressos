import { NextResponse } from "next/server";
import { markLeadThankYouViewed, markLeadWhatsappClicked } from "@/features/leads/lead.service";

type TrackPayload = {
  leadId?: string;
  type?: "thank_you_view" | "whatsapp_click";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TrackPayload;
    const leadId = body.leadId?.trim();

    if (!leadId || !body.type) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (body.type === "thank_you_view") {
      await markLeadThankYouViewed(leadId);
    }

    if (body.type === "whatsapp_click") {
      await markLeadWhatsappClicked(leadId);
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
