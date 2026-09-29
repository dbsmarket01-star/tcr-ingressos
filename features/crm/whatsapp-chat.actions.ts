"use server";

import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { clearCrmWhatsAppInboxCache, getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";
import { sendCartAbandonmentWhatsApp, sendWhatsAppMediaMessage, sendWhatsAppTextMessage, type WhatsAppMediaKind } from "@/features/whatsapp/whatsapp.service";
import { setWhatsAppAiConversationState } from "@/features/ai/whatsapp-support-ai.service";
import { savePublicMediaUpload } from "@/features/uploads/local-upload.service";
import { prisma } from "@/lib/prisma";

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

function mediaKindFromFile(file: File): WhatsAppMediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
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
  const mediaCandidates = [formData.get("media"), formData.get("audio")];
  const mediaFile = mediaCandidates.find((value): value is File => value instanceof File && value.size > 0) || null;
  if (mediaFile && mediaFile.size > 10 * 1024 * 1024) {
    redirect(buildRedirect({ orderCode, leadId, phone, status: "erro", message: "O arquivo para envio deve ter no máximo 10MB." }));
  }
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

  if (!text && !mediaFile) {
    redirect(
      buildRedirect({
        orderCode,
        leadId,
        phone,
        status: "erro",
        message: "Digite uma mensagem ou selecione um arquivo antes de enviar."
      })
    );
  }

  try {
    if (mediaFile) {
      const mediaUrl = await savePublicMediaUpload(mediaFile, `whatsapp/outbound/${admin.organizationId}`);
      if (!mediaUrl) throw new Error("Não foi possível armazenar o arquivo.");
      await sendWhatsAppMediaMessage({
        to: conversation.contact.phone,
        kind: mediaKindFromFile(mediaFile),
        mediaUrl,
        fileName: mediaFile.name,
        mimeType: mediaFile.type,
        caption: text || null,
        organizationId: admin.organizationId,
        eventId: conversation.contact.eventId,
        orderId: conversation.contact.orderId,
        leadId: conversation.contact.leadId,
        recipientName: conversation.contact.name
      });
    } else {
      await sendTextMessageOnce({
        to: conversation.contact.phone,
        text,
        organizationId: admin.organizationId,
        eventId: conversation.contact.eventId,
        orderId: conversation.contact.orderId,
        leadId: conversation.contact.leadId,
        recipientName: conversation.contact.name
      });
    }
    await setWhatsAppAiConversationState({
      organizationId: admin.organizationId,
      phone: conversation.contact.phone,
      mode: "PAUSED",
      reason: "Atendente humano enviou uma mensagem; IA pausada automaticamente por 12 horas.",
      adminUserId: admin.id
    });
    clearCrmWhatsAppInboxCache(admin.organizationId);
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
      message: "Mensagem enviada. A IA ficará pausada nesta conversa por 12 horas."
    })
  );
}

export async function setCrmWhatsAppAiMode(formData: FormData) {
  const admin = await requirePermission("CRM");
  const orderCode = getFormText(formData, "orderCode");
  const leadId = getFormText(formData, "leadId");
  const phone = getFormText(formData, "phone");
  const mode = getFormText(formData, "mode") === "ACTIVE" ? "ACTIVE" : "PAUSED";
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const conversation = await getCrmWhatsAppConversation({
    orderCode,
    leadId,
    phone,
    organizationId: admin.organizationId,
    allowedEventIds
  });
  if (!conversation.contact?.phone) {
    redirect(buildRedirect({ orderCode, leadId, phone, status: "erro", message: "Conversa sem telefone valido." }));
  }
  await setWhatsAppAiConversationState({
    organizationId: admin.organizationId,
    phone: conversation.contact.phone,
    mode,
    reason: mode === "ACTIVE" ? "IA reativada pelo atendente." : "Atendente humano assumiu a conversa.",
    adminUserId: admin.id
  });
  redirect(
    buildRedirect({
      orderCode,
      leadId,
      phone,
      status: "ok",
      message: mode === "ACTIVE" ? "Atendimento automatico reativado." : "IA pausada; atendimento humano ativo."
    })
  );
}

export async function setCrmWhatsAppFollowUp(formData: FormData) {
  const admin = await requirePermission("CRM");
  const phone = getFormText(formData, "phone");
  const enabled = getFormText(formData, "enabled") === "true";
  const key = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (!key) redirect(buildRedirect({ status: "erro", message: "Conversa sem telefone válido." }));
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: admin.id,
      action: enabled ? "WHATSAPP_FOLLOWUP_ENABLED" : "WHATSAPP_FOLLOWUP_DISABLED",
      entityType: "WHATSAPP_CONVERSATION",
      entityId: `${admin.organizationId}:${key}`,
      metadata: { phone }
    }
  });
  clearCrmWhatsAppInboxCache(admin.organizationId);
  redirect(buildRedirect({ phone, status: "ok", message: enabled ? "Conversa movida para Em atendimento / Follow-up." : "Conversa removida do Follow-up." }));
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
