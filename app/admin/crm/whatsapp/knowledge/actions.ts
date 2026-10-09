"use server";

import { AdminRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";

export async function createSupportKnowledge(formData: FormData) {
  const admin = await requirePermission("CRM");
  if (admin.role !== AdminRole.OWNER && admin.role !== AdminRole.MANAGER) throw new Error("Somente gestores podem cadastrar regras da IA.");
  const eventId = String(formData.get("eventId") || "").trim() || null;
  const topic = String(formData.get("topic") || "").trim().toLocaleLowerCase("pt-BR").slice(0, 120);
  const question = String(formData.get("question") || "").trim().slice(0, 300);
  const answer = String(formData.get("answer") || "").trim().slice(0, 1000);
  if (!topic || !question || !answer) throw new Error("Preencha assunto, pergunta e resposta.");
  if (eventId && !await prisma.event.findFirst({ where: { id: eventId, organizationId: admin.organizationId }, select: { id: true } })) throw new Error("Evento inválido.");
  await prisma.$transaction(async (tx) => {
    await tx.whatsAppSupportKnowledge.updateMany({ where: { organizationId: admin.organizationId, eventId, topic, status: "APPROVED" }, data: { status: "SUPERSEDED" } });
    await tx.whatsAppSupportKnowledge.create({ data: {
      organizationId: admin.organizationId, eventId, topic, question, answer, status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date()
    } });
  });
  revalidatePath("/admin/crm/whatsapp/knowledge");
}

export async function reviewSupportKnowledge(formData: FormData) {
  const admin = await requirePermission("CRM");
  if (admin.role !== AdminRole.OWNER && admin.role !== AdminRole.MANAGER) throw new Error("Somente gestores podem aprovar regras da IA.");
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  if (!id || !["APPROVED", "REJECTED"].includes(decision)) throw new Error("Revisão inválida.");
  const rule = await prisma.whatsAppSupportKnowledge.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (!rule) throw new Error("Regra não encontrada.");
  const question = String(formData.get("question") || "").trim().slice(0, 300);
  const answer = String(formData.get("answer") || "").trim().slice(0, 1000);
  if (decision === "APPROVED" && (!question || !answer)) throw new Error("Preencha a pergunta e a resposta.");
  await prisma.$transaction(async (tx) => {
    if (decision === "APPROVED") {
      await tx.whatsAppSupportKnowledge.updateMany({ where: { organizationId: admin.organizationId, eventId: rule.eventId, topic: rule.topic, status: "APPROVED", id: { not: id } }, data: { status: "SUPERSEDED" } });
    }
    await tx.whatsAppSupportKnowledge.update({
      where: { id },
      data: { status: decision, question: question || rule.question, answer: answer || rule.answer, reviewedById: admin.id, reviewedAt: new Date() }
    });
  });
  await prisma.adminAuditLog.create({
    data: { adminUserId: admin.id, action: `WHATSAPP_KNOWLEDGE_${decision}`, entityType: "WHATSAPP_SUPPORT_KNOWLEDGE", entityId: id, metadata: { eventId: rule.eventId, topic: rule.topic } }
  });
  revalidatePath("/admin/crm/whatsapp/knowledge");
}
