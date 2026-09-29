import { NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCrmWhatsAppInbox } from "@/features/crm/whatsapp-chat.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requirePermission("CRM");
  const inbox = await getCrmWhatsAppInbox({
    organizationId: admin.organizationId,
    allowedEventIds: getAdminAllowedEventIds(admin)
  });
  const latestInbound = inbox
    .filter((item) => item.latestInboundId && item.latestInboundAt)
    .sort((left, right) => right.latestInboundAt!.getTime() - left.latestInboundAt!.getTime())[0];

  return NextResponse.json(
    {
      latestInbound: latestInbound
        ? {
            id: latestInbound.latestInboundId,
            at: latestInbound.latestInboundAt?.toISOString(),
            name: latestInbound.name,
            message: latestInbound.latestInboundMessage,
            phone: latestInbound.phone
          }
        : null,
      unreadCount: inbox.filter((item) => item.needsReply).length
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
