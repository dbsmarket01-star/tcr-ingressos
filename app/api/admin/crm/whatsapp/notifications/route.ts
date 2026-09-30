import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCrmWhatsAppNotificationSnapshot } from "@/features/crm/whatsapp-chat.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requirePermission("CRM");
  const latestInbound = await getCrmWhatsAppNotificationSnapshot({
    organizationId: admin.organizationId,
    allowedEventIds: getAdminAllowedEventIds(admin)
  });

  return NextResponse.json(
    {
      latestInbound: latestInbound
        ? {
            id: latestInbound.id,
            at: latestInbound.at.toISOString(),
            name: latestInbound.name,
            message: latestInbound.message,
            phone: latestInbound.phone
          }
        : null
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
