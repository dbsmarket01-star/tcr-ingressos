import { NextRequest, NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCrmWhatsAppNotificationDelta } from "@/features/crm/whatsapp-chat.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requirePermission("CRM");
  const afterAt = new Date(request.nextUrl.searchParams.get("afterAt") || "");
  const afterId = request.nextUrl.searchParams.get("afterId") || "";
  if (Number.isNaN(afterAt.getTime()) || !afterId || afterId.length > 100) {
    return NextResponse.json({ error: "Cursor inválido." }, { status: 400 });
  }
  const delta = await getCrmWhatsAppNotificationDelta({
    organizationId: admin.organizationId,
    allowedEventIds: getAdminAllowedEventIds(admin),
    afterAt,
    afterId
  });
  return NextResponse.json(delta, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
