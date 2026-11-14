import { NextResponse } from "next/server";
import { canAccessArea, getCurrentAdmin } from "@/features/auth/auth.service";
import { sendCrmWhatsAppMessage } from "@/features/crm/whatsapp-chat.actions";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) {
    return NextResponse.json({ ok: false, message: "Origem inválida." }, { status: 403 });
  }
  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ ok: false, message: "Origem inválida." }, { status: 403 });
    }
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ ok: false, message: "Sua sessão expirou. Entre novamente para enviar." }, { status: 401 });
    }
    if (!canAccessArea(admin.role, "CRM")) {
      return NextResponse.json({ ok: false, message: "Acesso ao CRM não autorizado." }, { status: 403 });
    }
    const formData = await request.formData();
    const result = await sendCrmWhatsAppMessage(formData);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WhatsApp CRM] Falha no envio manual", error);
    return NextResponse.json(
      { ok: false, message: "Não foi possível enviar. Confira a conversa antes de tentar novamente." },
      { status: 500 }
    );
  }
}
