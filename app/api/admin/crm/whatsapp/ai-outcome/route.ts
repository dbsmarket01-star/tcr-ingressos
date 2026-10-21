import { NextRequest, NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getWhatsAppAiConversationState } from "@/features/ai/whatsapp-support-ai.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requirePermission("CRM");
  const messageId = request.nextUrl.searchParams.get("messageId") || "";
  if (!messageId || messageId.length > 100) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const message = await prisma.whatsAppMessageLog.findFirst({
    where: {
      id: messageId,
      organizationId: admin.organizationId,
      status: "RECEIVED",
      ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
    },
    select: { recipientPhone: true, webhookPayload: true }
  });
  if (!message?.recipientPhone) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  const payload = message.webhookPayload && typeof message.webhookPayload === "object" && !Array.isArray(message.webhookPayload)
    ? message.webhookPayload as Record<string, unknown> : {};
  const ai = payload._ai && typeof payload._ai === "object" && !Array.isArray(payload._ai) ? payload._ai as Record<string, unknown> : {};
  const state = await getWhatsAppAiConversationState(admin.organizationId, message.recipientPhone);
  return NextResponse.json({ status: typeof ai.status === "string" ? ai.status : null, mode: state.mode, phone: message.recipientPhone }, { headers: { "Cache-Control": "no-store" } });
}
