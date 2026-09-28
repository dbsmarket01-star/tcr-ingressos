"use server";

import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";
import { sendCartAbandonmentWhatsApp, sendWhatsAppTextMessage } from "@/features/whatsapp/whatsapp.service";

const recentTextSends = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();
const TEXT_SEND_DEDUPLICATION_MS = 20_000;

function sendTextMessageOnce(input: Parameters<typeof sendWhatsAppTextMessage>[0]) {
  const now = Date.now();

  for (const [key, value] of recentTextSends) {
    if (value.expiresAt <= now) recentTextSends.delete(key);
  }

  const phone = String(input.to || "").replace(/\D/g, "");
  const key = [input.organizationId || "", phone, input.text.trim()].join("|");
  const recent = recentTextSends.get(key);

  if (recent && recent.expiresAt > now) {
    return recent.promise;
  }

  const promise = sendWhatsAppTextMessage(input);
  recentTextSends.set(key, { expiresAt: now + TEXT_SEND_DEDUPLICATION_MS, promise });
  return promise;
}

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function buildRedirect(input: {
  orderCode?: string;
  leadId?: string;
  phone?: string;
  status?: string;
  message?: string;
}) {
  const query = new URLSearchParams();

  if (input.orderCode) {
    query.set("orderCode", input.orderCode);
  }

  if (input.leadId) {
    query.set("leadId", input.leadId);
  }

  if (input.phone) {
    query.set("phone", input.phone);
  }

  if (input.status) {
    query.set("status", input.status);
  }

  if (input.message) {
    query.set("message", input.message);
  }

  return `/admin/crm/whatsapp?${query.toString()}`;
}

export async function sendCrmWhatsAppMessage(formData: FormData) {
  const admin = await requirePermission("CRM");
  const orderCode = getFormText(formData, "orderCode");
  const leadId = getFormText(formData, "leadId");
  const phone = getFormText(formData, "phone");
  const text = getFormText(formData, "text");
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const conversation = await getCrmWhatsAppConversation({
    orderCode,
    leadId,
    phone,
    organizationId: admin.organizationId,
    allowedEventIds
  });

  if (!conversation.contact?.phone) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Contato sem telefone valido para WhatsApp."
      })
    );
  }

  if (!conversation.canReply) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Este contato ainda nao abriu uma janela de atendimento de 24h. Use um template aprovado para iniciar a conversa."
      })
    );
  }

  if (!text) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Digite a mensagem antes de enviar."
      })
    );
  }

  try {
    await sendTextMessageOnce({
      to: conversation.contact.phone,
      text,
      organizationId: admin.organizationId,
      eventId: conversation.contact.eventId,
      orderId: conversation.contact.orderId,
      leadId: conversation.contact.leadId,
      recipientName: conversation.contact.name
    });
  } catch (error) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: error instanceof Error ? error.message : "Nao foi possivel enviar a mensagem."
      })
    );
  }

  redirect(
    buildRedirect({
      orderCode,
      leadId,
      phone,
      status: "ok",
      message: "Mensagem enviada."
    })
  );
}

export async function sendCrmWhatsAppApprovedTemplate(formData: FormData) {
  const admin = await requirePermission("CRM");
  const orderCode = getFormText(formData, "orderCode");
  const leadId = getFormText(formData, "leadId");
  const phone = getFormText(formData, "phone");
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const conversation = await getCrmWhatsAppConversation({
    orderCode,
    leadId,
    phone,
    organizationId: admin.organizationId,
    allowedEventIds
  });
  const contact = conversation.contact;

  if (!contact?.phone) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Contato sem telefone valido para WhatsApp."
      })
    );
  }

  if (!contact.orderId || !contact.orderCode) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Para iniciar conversa automaticamente, abra pelo card de um pedido."
      })
    );
  }

  let skippedByRecentMessage = false;

  try {
    const delivery = await sendCartAbandonmentWhatsApp({
      buyerName: contact.name,
      buyerPhone: contact.phone,
      eventTitle: contact.eventTitle || "evento",
      cartSummary: contact.cartSummary || "ingressos selecionados",
      orderCode: contact.orderCode,
      orderUrl: `https://www.tcringressos.app.br/pedido/${contact.orderCode}`,
      expiresAt: contact.orderExpiresAt || new Date(Date.now() + 15 * 60 * 1000),
      organizationId: admin.organizationId,
      eventId: contact.eventId,
      orderId: contact.orderId
    });
    skippedByRecentMessage = "skipped" in delivery && delivery.skipped;
  } catch (error) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: error instanceof Error ? error.message : "Nao foi possivel enviar o template aprovado."
      })
    );
  }

  if (skippedByRecentMessage) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Mensagem não enviada: este contato já recebeu recuperação de carrinho nas últimas 24 horas."
      })
    );
  }

  redirect(
    buildRedirect({
      orderCode,
      leadId,
      phone,
      status: "ok",
      message: "Template aprovado enviado ao cliente."
    })
  );
}
