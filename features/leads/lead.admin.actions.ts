"use server";

import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { sendLeadBroadcastEmail } from "@/features/email/email.service";
import { getEventForManagement } from "@/features/events/event.service";
import { listEventLeads } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";

function splitIntoBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

export async function sendLeadBroadcastAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const organizationContext = await getCurrentOrganizationContext();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!eventId) {
    redirect("/admin/events?error=Evento%20nao%20informado.");
  }

  await requireEventAccess(eventId);

  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Evento não encontrado.")}`);
  }

  if (subject.length < 4 || body.length < 12) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Preencha assunto e mensagem com um conteúdo mais completo.")}`);
  }

  let imageUrl: string | null = null;

  try {
    imageUrl = await savePublicImageUpload(
      formData.get("imageFile") as File | null,
      `events/${event.slug}/lead-broadcast`
    );
  } catch (error) {
    redirect(
      `/admin/events/${eventId}/leads?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Não foi possível salvar a imagem do e-mail."
      )}`
    );
  }

  const leads = await listEventLeads(event.id);
  const companySettings = await getCompanySettingsByOrganizationId(admin.organizationId!);

  if (leads.length === 0) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Ainda não existem leads cadastrados para este evento.")}`);
  }

  const batches = splitIntoBatches(leads, 20);
  let sentCount = 0;

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((lead) =>
        sendLeadBroadcastEmail({
          to: lead.email,
          name: lead.name,
          subject,
          body,
          imageUrl,
          brandName: organizationContext.brandName,
          eventTitle: event.title,
          whatsappGroupUrl: event.leadCaptureWhatsappGroupUrl,
          supportEmail: companySettings.supportEmail
        })
      )
    );

    sentCount += results.filter((result) => result.status === "fulfilled").length;
  }

  redirect(`/admin/events/${eventId}/leads?sent=${sentCount}`);
}
