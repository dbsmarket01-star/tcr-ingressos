import { NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { fetchWhatsAppMediaById } from "@/features/whatsapp/whatsapp.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ mediaId: string }> }) {
  await requirePermission("CRM");
  try {
    const { mediaId } = await context.params;
    const media = await fetchWhatsAppMediaById(mediaId);
    return new NextResponse(media.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": media.mimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mídia indisponível." }, { status: 404 });
  }
}
