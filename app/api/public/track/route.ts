import { EventPageVisitType } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordEventPageVisit } from "@/features/analytics/page-visit.service";

type TrackPayload = {
  eventId?: string;
  sessionKey?: string;
  pageType?: EventPageVisitType;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TrackPayload;
    const eventId = body.eventId?.trim();
    const sessionKey = body.sessionKey?.trim();
    const pageType = body.pageType;

    if (!eventId || !sessionKey || !pageType) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (pageType !== "LEAD_CAPTURE" && pageType !== "PUBLIC_EVENT") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await recordEventPageVisit({
      eventId,
      sessionKey,
      pageType
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
