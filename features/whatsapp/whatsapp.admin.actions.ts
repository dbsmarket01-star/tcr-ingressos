"use server";

import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { sendBulkWhatsApp, isWhatsAppConfigured } from "@/features/whatsapp/whatsapp.service";
import { getPublicEventUrl } from "@/lib/public-url";
import { prisma } from "@/lib/prisma";

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithStatus(params: Record<string, string | number>): never {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    query.set(key, String(value));
  }

  redirect(`/admin/marketing/whatsapp?${query.toString()}`);
}

export async function sendLeadWhatsAppBroadcast(formData: FormData) {
  const admin = await requirePermission("MARKETING");
  const eventId = getFormText(formData, "eventId");
  const templateName = getFormText(formData, "templateName");

  if (!eventId || !templateName) {
    redirectWithStatus({
      status: "erro",
      message: "Informe o evento e o template aprovado na Meta."
    });
  }

  if (!isWhatsAppConfigured()) {
    redirectWithStatus({
      status: "erro",
      message: "WhatsApp ainda sem credenciais da Meta configuradas."
    });
  }

  const allowedEventIds = getAdminAllowedEventIds(admin);
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId: admin.organizationId,
      status: {
        not: "DRAFT"
      },
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
    },
    select: {
      id: true,
      title: true,
      slug: true,
      organization: {
        select: {
          publicDomain: true,
          adminDomain: true
        }
      }
    }
  });

  if (!event) {
    redirectWithStatus({
      status: "erro",
      message: "Evento nao encontrado para esta bilheteria."
    });
  }

  const leads = await prisma.eventLead.findMany({
    where: {
      eventId: event.id,
      phone: {
        not: null
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      name: true,
      phone: true
    }
  });

  if (leads.length === 0) {
    redirectWithStatus({
      status: "erro",
      message: "Este evento ainda nao tem leads com telefone."
    });
  }

  const eventUrl = getPublicEventUrl(event.slug, event.organization);
  const result = await sendBulkWhatsApp(leads, templateName, (lead) => [lead.name, event.title, eventUrl]);

  redirectWithStatus({
    status: result.failed > 0 ? "parcial" : "ok",
    sent: result.sent,
    failed: result.failed,
    total: leads.length
  });
}
