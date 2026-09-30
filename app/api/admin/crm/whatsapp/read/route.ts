import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/features/auth/auth.service";
import { clearCrmWhatsAppInboxCache } from "@/features/crm/whatsapp-chat.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requirePermission("CRM");
  const body = (await request.json().catch(() => ({}))) as { phone?: string; messageId?: string };
  const phone = String(body.phone || "");
  const key = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (!key || !body.messageId) return NextResponse.json({ ok: false }, { status: 400 });

  const alreadyRead = await prisma.adminAuditLog.findFirst({
    where: {
      action: "WHATSAPP_CONVERSATION_READ",
      entityType: "WHATSAPP_CONVERSATION",
      entityId: `${admin.organizationId}:${key}`,
      metadata: { path: ["messageId"], equals: body.messageId }
    },
    select: { id: true }
  });
  if (!alreadyRead) {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: "WHATSAPP_CONVERSATION_READ",
        entityType: "WHATSAPP_CONVERSATION",
        entityId: `${admin.organizationId}:${key}`,
        metadata: { messageId: body.messageId, phone }
      }
    });
  }
  clearCrmWhatsAppInboxCache(admin.organizationId);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
