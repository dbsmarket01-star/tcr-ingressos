import { NextRequest, NextResponse } from "next/server";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";
import { getWhatsAppAiConversationState } from "@/features/ai/whatsapp-support-ai.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requirePermission("CRM");
  const phone = request.nextUrl.searchParams.get("phone") || undefined;
  const orderCode = request.nextUrl.searchParams.get("orderCode") || undefined;
  const leadId = request.nextUrl.searchParams.get("leadId") || undefined;
  if (!phone && !orderCode && !leadId) return NextResponse.json({ error: "Conversa não informada." }, { status: 400 });
  const conversation = await getCrmWhatsAppConversation({
    organizationId: admin.organizationId,
    allowedEventIds: getAdminAllowedEventIds(admin),
    phone,
    orderCode,
    leadId
  });
  const aiState = conversation.contact?.phone
    ? await getWhatsAppAiConversationState(admin.organizationId, conversation.contact.phone)
    : { mode: "DISABLED" as const, reason: "Selecione uma conversa." };
  return NextResponse.json({ conversation, aiState }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
