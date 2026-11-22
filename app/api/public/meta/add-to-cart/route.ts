import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { assertRateLimit } from "@/features/security/rate-limit";
import { trackMetaAddToCart } from "@/features/tracking/meta-conversions.service";

const cartEventSchema = z.object({
  eventId: z.string().min(1).max(100),
  trackingEventId: z.string().regex(/^cart:[a-f0-9-]{36}$/i),
  contents: z.array(z.object({ id: z.string().min(1).max(100), quantity: z.number().int().min(1).max(50) })).min(1).max(30),
  sourceUrl: z.string().url().max(2000),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 8_000) return new NextResponse(null, { status: 413 });
    const parsed = cartEventSchema.safeParse(await request.json());
    if (!parsed.success) return new NextResponse(null, { status: 400 });

    const organization = await getCurrentOrganizationContext();
    const source = new URL(parsed.data.sourceUrl);
    const requestUrl = new URL(request.url);
    if (!organization.isMatchedByHost || source.origin !== requestUrl.origin || !source.pathname.startsWith("/evento/")) {
      return new NextResponse(null, { status: 403 });
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== source.origin) return new NextResponse(null, { status: 403 });
    const userAgent = request.headers.get("user-agent")?.trim();
    if (!userAgent) return new NextResponse(null, { status: 400 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
    assertRateLimit(`meta-add-to-cart:${ip}`, { limit: 30, windowMs: 60_000 });
    await trackMetaAddToCart({
      organizationId: organization.organization.id,
      ...parsed.data,
      clientIpAddress: ip === "unknown" ? undefined : ip,
      clientUserAgent: userAgent
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[meta-capi] Falha ao enviar AddToCart", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
