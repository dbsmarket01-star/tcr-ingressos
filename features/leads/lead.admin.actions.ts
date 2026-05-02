"use server";

import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";
import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { sendLeadBroadcastEmail } from "@/features/email/email.service";
import { getEventForManagement } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";
import { listEventLeadsForBroadcast } from "@/features/leads/lead.service";

function splitIntoBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function normalizeDestinationUrl(value: string, fallbackUrl?: string | null) {
  const text = value.trim();

  if (!text) {
    return fallbackUrl?.trim() || null;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (text.startsWith("www.")) {
    return `https://${text}`;
  }

  return `https://${text}`;
}

function normalizeBodySignature(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseMunicipalityFilters(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBrazilDateStart(value: string) {
  return value ? new Date(`${value}T00:00:00-03:00`) : null;
}

function parseBrazilDateEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999-03:00`) : null;
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function buildScopeSummary({
  testRecipientEmail,
  municipalities,
  dateFrom,
  dateTo,
  count
}: {
  testRecipientEmail?: string | null;
  municipalities: string[];
  dateFrom?: string;
  dateTo?: string;
  count: number;
}) {
  if (testRecipientEmail) {
    return `teste para ${testRecipientEmail}`;
  }

  const fragments: string[] = [`${count} lead(s)`];

  if (dateFrom && dateTo) {
    fragments.push(dateFrom === dateTo ? `dia ${dateFrom}` : `período ${dateFrom} a ${dateTo}`);
  } else if (dateFrom) {
    fragments.push(`a partir de ${dateFrom}`);
  } else if (dateTo) {
    fragments.push(`até ${dateTo}`);
  }

  if (municipalities.length > 0) {
    fragments.push(`município(s): ${municipalities.join(", ")}`);
  }

  if (fragments.length === 1) {
    fragments.push("todos os leads");
  }

  return fragments.join(" · ");
}

export async function sendLeadBroadcastAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const organizationContext = await getCurrentOrganizationContext();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const destinationUrl = String(formData.get("destinationUrl") ?? "").trim();
  const dateFrom = String(formData.get("dateFrom") ?? "").trim();
  const dateTo = String(formData.get("dateTo") ?? "").trim();
  const municipalities = parseMunicipalityFilters(String(formData.get("municipalities") ?? ""));
  const testRecipientEmail = normalizeEmailAddress(String(formData.get("testRecipientEmail") ?? ""));

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

  if (dateFrom && dateTo && dateFrom > dateTo) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("A data inicial não pode ser maior do que a data final.")}#lead-broadcast`);
  }

  if (testRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipientEmail)) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Informe um e-mail de teste válido.")}#lead-broadcast`);
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

  const leads = await listEventLeadsForBroadcast(event.id, {
    dateFrom: parseBrazilDateStart(dateFrom),
    dateTo: parseBrazilDateEnd(dateTo),
    municipalities
  });
  const companySettings = await getCompanySettingsByOrganizationId(admin.organizationId!);
  const normalizedDestinationUrl = normalizeDestinationUrl(destinationUrl, event.leadCaptureWhatsappGroupUrl);

  if (!normalizedDestinationUrl) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Informe um link de destino válido para o e-mail.")}`);
  }

  const publicBaseUrl = getPublicBaseUrl({
    publicDomain: organizationContext.organization.publicDomain
  });
  const scopeSummary = buildScopeSummary({
    testRecipientEmail: testRecipientEmail || null,
    municipalities,
    dateFrom,
    dateTo,
    count: leads.length
  });

  if (testRecipientEmail) {
    const matchedLead = leads.find((lead) => normalizeEmailAddress(lead.email) === testRecipientEmail);

    await sendLeadBroadcastEmail({
      to: testRecipientEmail,
      name: matchedLead?.name || "Teste",
      subject,
      body,
      imageUrl,
      brandName: organizationContext.brandName,
      eventTitle: event.title,
      ctaLabel: ctaLabel || "Abrir link",
      ctaUrl: normalizedDestinationUrl,
      supportEmail: companySettings.supportEmail
    });

    redirect(
      `/admin/events/${eventId}/leads?sent=1&mode=test&scope=${encodeURIComponent(scopeSummary)}#lead-broadcast`
    );
  }

  if (leads.length === 0) {
    redirect(
      `/admin/events/${eventId}/leads?error=${encodeURIComponent(
        "Nenhum lead encontrado para os filtros informados."
      )}#lead-broadcast`
    );
  }

  const hasScopedFilters = Boolean(dateFrom || dateTo || municipalities.length > 0);

  if (!hasScopedFilters) {
    const recentDuplicateWindow = new Date(Date.now() - 3 * 60 * 1000);
    const duplicateCampaign = await prisma.leadEmailCampaign.findFirst({
      where: {
        eventId: event.id,
        subject,
        body: normalizeBodySignature(body),
        destinationUrl: normalizedDestinationUrl,
        ctaLabel: ctaLabel || null,
        createdAt: {
          gte: recentDuplicateWindow
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (duplicateCampaign) {
      redirect(
        `/admin/events/${eventId}/leads?error=${encodeURIComponent(
          "Encontramos um disparo idêntico feito há poucos minutos. Aguarde um pouco antes de enviar de novo."
        )}#lead-broadcast`
      );
    }
  }

  const campaign = await prisma.leadEmailCampaign.create({
    data: {
      eventId: event.id,
      subject,
      body: normalizeBodySignature(body),
      imageUrl,
      ctaLabel: ctaLabel || null,
      destinationUrl: normalizedDestinationUrl
    }
  });

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
          ctaLabel: ctaLabel || "Abrir link",
          ctaUrl: `${publicBaseUrl}/r/lead-email/${campaign.id}/${lead.id}`,
          supportEmail: companySettings.supportEmail
        })
      )
    );

    sentCount += results.filter((result) => result.status === "fulfilled").length;
  }

  await prisma.leadEmailCampaign.update({
    where: {
      id: campaign.id
    },
    data: {
      sentCount
    }
  });

  redirect(
    `/admin/events/${eventId}/leads?sent=${sentCount}&scope=${encodeURIComponent(scopeSummary)}#lead-broadcast`
  );
}
