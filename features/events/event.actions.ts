"use server";

import { EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEvent, duplicateEvent, updateEvent, updateEventStatus } from "./event.service";
import { eventDraftSchema } from "./event.schema";
import { createAuditLog } from "@/features/audit/audit.service";
import { requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function validationMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ path?: Array<string | number>; message?: string }>;
    const firstIssue = issues[0];
    const field = firstIssue?.path?.join(".");

    if (field) {
      const fieldLabels: Record<string, string> = {
        title: "Nome do evento",
        slug: "Slug público",
        description: "Descrição",
        startsAt: "Início do evento",
        endsAt: "Fim do evento",
        venueName: "Nome do local",
        venueAddress: "Endereço",
        city: "Cidade",
        state: "UF",
        salesStartsAt: "Início das vendas",
        salesEndsAt: "Fim das vendas",
        bannerUrl: "Banner do evento",
        bannerPosition: "Exibição do banner",
        bannerCrop: "Enquadramento do banner",
        eventMapImageUrl: "Mapa do evento",
        eventMapCrop: "Enquadramento do mapa",
        eventMapTemplate: "Modelo do mapa",
        eventMapNotes: "Observações do mapa",
        metaPixelId: "Meta Pixel ID",
        metaConversionsApiToken: "Token da API de conversão do Meta",
        metaTestEventCode: "Código de teste do Meta",
        googleTagManagerId: "Google Tag Manager ID",
        seoTitle: "Título SEO",
        seoDescription: "Descrição SEO",
        seoImageUrl: "Imagem SEO",
        supportWhatsappUrl: "Link do WhatsApp",
        leadCaptureHeadline: "Título da captação",
        leadCaptureDescription: "Descrição da captação",
        leadCaptureOfferText: "Oferta da captação",
        leadCaptureCtaText: "Texto do botão da captação",
        leadCaptureHeroImageUrl: "Imagem da captação",
        leadCaptureHeroCrop: "Enquadramento da imagem da captação",
        leadCaptureVenueGallery: "Imagens do local",
        leadCaptureVideoUrl: "Vídeo da captação",
        leadCaptureWhatsappGroupUrl: "Link do grupo de WhatsApp",
        leadCaptureThankYouTitle: "Título do agradecimento",
        leadCaptureThankYouDescription: "Descrição do agradecimento",
        leadCaptureThankYouButtonText: "Texto do botão do agradecimento",
        autoLeadCaptureEmailEnabled: "E-mail automático do lead",
        autoPurchaseApprovedEmailEnabled: "E-mail automático de compra aprovada",
        autoPendingPaymentEmailEnabled: "E-mail automático de pagamento pendente",
        conversionSocialProofText: "Prova social",
        conversionUrgencyText: "Texto de urgência",
        conversionCtaText: "Texto do botão",
        highlightedLotId: "Lote em destaque"
      };

      const label = fieldLabels[field] || field;

      if (field === "startsAt") {
        return "Preencha o campo Início do evento com data e horário.";
      }

      return `Verifique o campo: ${label}.`;
    }
  }

  return "Verifique os campos obrigatórios do evento.";
}

export async function createEventAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");
  const slug = slugify(rawSlug || title);
  let bannerUploadUrl: string | null = null;
  let mapUploadUrl: string | null = null;
  let seoUploadUrl: string | null = null;
  let leadHeroUploadUrl: string | null = null;

  try {
    bannerUploadUrl = await savePublicImageUpload(formData.get("bannerFile") as File | null, `events/${slug}/banner`);
    mapUploadUrl = await savePublicImageUpload(formData.get("eventMapFile") as File | null, `events/${slug}/map`);
    seoUploadUrl = await savePublicImageUpload(formData.get("seoImageFile") as File | null, `events/${slug}/seo`);
    leadHeroUploadUrl = await savePublicImageUpload(formData.get("leadCaptureHeroFile") as File | null, `events/${slug}/lead-hero`);
  } catch (error) {
    redirect(`/admin/events/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível salvar a imagem.")}`);
  }

  const parsed = eventDraftSchema.safeParse({
    title,
    slug,
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim(),
    startsAt: formData.get("startsAt"),
    endsAt: optionalDate(formData.get("endsAt")),
    venueName: String(formData.get("venueName") ?? "").trim(),
    venueAddress: String(formData.get("venueAddress") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    salesStartsAt: optionalDate(formData.get("salesStartsAt")),
    salesEndsAt: optionalDate(formData.get("salesEndsAt")),
    bannerUrl: bannerUploadUrl || String(formData.get("bannerUrl") ?? "").trim(),
    bannerPosition: String(formData.get("bannerPosition") ?? "center center"),
    bannerCrop: String(formData.get("bannerCrop") ?? "").trim() || undefined,
    eventMapImageUrl: mapUploadUrl || String(formData.get("eventMapImageUrl") ?? "").trim(),
    eventMapCrop: String(formData.get("eventMapCrop") ?? "").trim() || undefined,
    eventMapTemplate: String(formData.get("eventMapTemplate") ?? "AUTO"),
    eventMapNotes: String(formData.get("eventMapNotes") ?? "").trim() || undefined,
    importantInfo: String(formData.get("importantInfo") ?? "").trim() || undefined,
    metaPixelId: String(formData.get("metaPixelId") ?? "").trim() || undefined,
    metaConversionsApiToken: String(formData.get("metaConversionsApiToken") ?? "").trim() || undefined,
    metaTestEventCode: String(formData.get("metaTestEventCode") ?? "").trim() || undefined,
    googleTagManagerId: String(formData.get("googleTagManagerId") ?? "").trim() || undefined,
    seoTitle: String(formData.get("seoTitle") ?? "").trim() || undefined,
    seoDescription: String(formData.get("seoDescription") ?? "").trim() || undefined,
    seoKeywords: String(formData.get("seoKeywords") ?? "").trim() || undefined,
    seoImageUrl: seoUploadUrl || String(formData.get("seoImageUrl") ?? "").trim(),
    supportWhatsappUrl: String(formData.get("supportWhatsappUrl") ?? "").trim() || undefined,
    leadCaptureEnabled: String(formData.get("leadCaptureEnabled") ?? "") === "on",
    leadCaptureHeadline: String(formData.get("leadCaptureHeadline") ?? "").trim() || undefined,
    leadCaptureDescription: String(formData.get("leadCaptureDescription") ?? "").trim() || undefined,
    leadCaptureOfferText: String(formData.get("leadCaptureOfferText") ?? "").trim() || undefined,
    leadCaptureCtaText: String(formData.get("leadCaptureCtaText") ?? "").trim() || undefined,
    leadCaptureHeroImageUrl: leadHeroUploadUrl || String(formData.get("leadCaptureHeroImageUrl") ?? "").trim(),
    leadCaptureHeroCrop: String(formData.get("leadCaptureHeroCrop") ?? "").trim() || undefined,
    leadCaptureVenueGallery: String(formData.get("leadCaptureVenueGallery") ?? "").trim() || undefined,
    leadCaptureVideoUrl: String(formData.get("leadCaptureVideoUrl") ?? "").trim() || undefined,
    leadCaptureWhatsappGroupUrl: String(formData.get("leadCaptureWhatsappGroupUrl") ?? "").trim() || undefined,
    leadCaptureThankYouTitle: String(formData.get("leadCaptureThankYouTitle") ?? "").trim() || undefined,
    leadCaptureThankYouDescription: String(formData.get("leadCaptureThankYouDescription") ?? "").trim() || undefined,
    leadCaptureThankYouButtonText: String(formData.get("leadCaptureThankYouButtonText") ?? "").trim() || undefined,
    autoLeadCaptureEmailEnabled: String(formData.get("autoLeadCaptureEmailEnabled") ?? "on") === "on",
    autoPurchaseApprovedEmailEnabled: String(formData.get("autoPurchaseApprovedEmailEnabled") ?? "on") === "on",
    autoPendingPaymentEmailEnabled: String(formData.get("autoPendingPaymentEmailEnabled") ?? "on") === "on",
    conversionSocialProofText: String(formData.get("conversionSocialProofText") ?? "").trim() || undefined,
    conversionUrgencyText: String(formData.get("conversionUrgencyText") ?? "").trim() || undefined,
    conversionCtaText: String(formData.get("conversionCtaText") ?? "").trim() || undefined,
    highlightedLotId: String(formData.get("highlightedLotId") ?? "").trim() || undefined
  });

  if (!parsed.success) {
    redirect(`/admin/events/new?error=${encodeURIComponent(validationMessage(parsed.error))}`);
  }

  await createEvent({
    ...parsed.data,
    status:
      status === "PUBLISHED"
        ? EventStatus.PUBLISHED
        : status === "UNPUBLISHED"
          ? EventStatus.UNPUBLISHED
          : EventStatus.DRAFT
  }, admin.organizationId!);

  revalidatePath("/admin/events");
  revalidatePath("/");
  revalidatePath(`/evento/${parsed.data.slug}`);
  revalidatePath(`/lista/${parsed.data.slug}`);
  revalidatePath(`/lista/${parsed.data.slug}/obrigado`);
  redirect("/admin/events");
}

export async function updateEventAction(formData: FormData) {
  await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");

  if (!eventId) {
    throw new Error("Evento não informado.");
  }

  await requireEventAccess(eventId);

  const slug = slugify(rawSlug || title);
  let bannerUploadUrl: string | null = null;
  let mapUploadUrl: string | null = null;
  let seoUploadUrl: string | null = null;
  let leadHeroUploadUrl: string | null = null;

  try {
    bannerUploadUrl = await savePublicImageUpload(formData.get("bannerFile") as File | null, `events/${slug}/banner`);
    mapUploadUrl = await savePublicImageUpload(formData.get("eventMapFile") as File | null, `events/${slug}/map`);
    seoUploadUrl = await savePublicImageUpload(formData.get("seoImageFile") as File | null, `events/${slug}/seo`);
    leadHeroUploadUrl = await savePublicImageUpload(formData.get("leadCaptureHeroFile") as File | null, `events/${slug}/lead-hero`);
  } catch (error) {
    redirect(`/admin/events/${eventId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível salvar a imagem.")}`);
  }

  const parsed = eventDraftSchema.safeParse({
    title,
    slug,
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim(),
    startsAt: formData.get("startsAt"),
    endsAt: optionalDate(formData.get("endsAt")),
    venueName: String(formData.get("venueName") ?? "").trim(),
    venueAddress: String(formData.get("venueAddress") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    salesStartsAt: optionalDate(formData.get("salesStartsAt")),
    salesEndsAt: optionalDate(formData.get("salesEndsAt")),
    bannerUrl:
      bannerUploadUrl ||
      String(formData.get("bannerUrl") ?? "").trim() ||
      String(formData.get("currentBannerUrl") ?? "").trim(),
    bannerPosition: String(formData.get("bannerPosition") ?? "center center"),
    bannerCrop: String(formData.get("bannerCrop") ?? "").trim() || undefined,
    eventMapImageUrl:
      mapUploadUrl ||
      String(formData.get("eventMapImageUrl") ?? "").trim() ||
      String(formData.get("currentEventMapImageUrl") ?? "").trim(),
    eventMapCrop: String(formData.get("eventMapCrop") ?? "").trim() || undefined,
    eventMapTemplate: String(formData.get("eventMapTemplate") ?? "AUTO"),
    eventMapNotes: String(formData.get("eventMapNotes") ?? "").trim() || undefined,
    importantInfo: String(formData.get("importantInfo") ?? "").trim() || undefined,
    metaPixelId: String(formData.get("metaPixelId") ?? "").trim() || undefined,
    metaConversionsApiToken: String(formData.get("metaConversionsApiToken") ?? "").trim() || undefined,
    metaTestEventCode: String(formData.get("metaTestEventCode") ?? "").trim() || undefined,
    googleTagManagerId: String(formData.get("googleTagManagerId") ?? "").trim() || undefined,
    seoTitle: String(formData.get("seoTitle") ?? "").trim() || undefined,
    seoDescription: String(formData.get("seoDescription") ?? "").trim() || undefined,
    seoKeywords: String(formData.get("seoKeywords") ?? "").trim() || undefined,
    seoImageUrl: seoUploadUrl || String(formData.get("seoImageUrl") ?? "").trim(),
    supportWhatsappUrl: String(formData.get("supportWhatsappUrl") ?? "").trim() || undefined,
    leadCaptureEnabled: String(formData.get("leadCaptureEnabled") ?? "") === "on",
    leadCaptureHeadline: String(formData.get("leadCaptureHeadline") ?? "").trim() || undefined,
    leadCaptureDescription: String(formData.get("leadCaptureDescription") ?? "").trim() || undefined,
    leadCaptureOfferText: String(formData.get("leadCaptureOfferText") ?? "").trim() || undefined,
    leadCaptureCtaText: String(formData.get("leadCaptureCtaText") ?? "").trim() || undefined,
    leadCaptureHeroImageUrl:
      leadHeroUploadUrl ||
      String(formData.get("leadCaptureHeroImageUrl") ?? "").trim() ||
      String(formData.get("currentLeadCaptureHeroImageUrl") ?? "").trim(),
    leadCaptureHeroCrop: String(formData.get("leadCaptureHeroCrop") ?? "").trim() || undefined,
    leadCaptureVenueGallery: String(formData.get("leadCaptureVenueGallery") ?? "").trim() || undefined,
    leadCaptureVideoUrl: String(formData.get("leadCaptureVideoUrl") ?? "").trim() || undefined,
    leadCaptureWhatsappGroupUrl: String(formData.get("leadCaptureWhatsappGroupUrl") ?? "").trim() || undefined,
    leadCaptureThankYouTitle: String(formData.get("leadCaptureThankYouTitle") ?? "").trim() || undefined,
    leadCaptureThankYouDescription: String(formData.get("leadCaptureThankYouDescription") ?? "").trim() || undefined,
    leadCaptureThankYouButtonText: String(formData.get("leadCaptureThankYouButtonText") ?? "").trim() || undefined,
    autoLeadCaptureEmailEnabled: String(formData.get("autoLeadCaptureEmailEnabled") ?? "on") === "on",
    autoPurchaseApprovedEmailEnabled: String(formData.get("autoPurchaseApprovedEmailEnabled") ?? "on") === "on",
    autoPendingPaymentEmailEnabled: String(formData.get("autoPendingPaymentEmailEnabled") ?? "on") === "on",
    conversionSocialProofText: String(formData.get("conversionSocialProofText") ?? "").trim() || undefined,
    conversionUrgencyText: String(formData.get("conversionUrgencyText") ?? "").trim() || undefined,
    conversionCtaText: String(formData.get("conversionCtaText") ?? "").trim() || undefined,
    highlightedLotId: String(formData.get("highlightedLotId") ?? "").trim() || undefined
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}/edit?error=${encodeURIComponent(validationMessage(parsed.error))}`);
  }

  await updateEvent(eventId, {
    ...parsed.data,
    status:
      status === "PUBLISHED"
        ? EventStatus.PUBLISHED
        : status === "UNPUBLISHED"
          ? EventStatus.UNPUBLISHED
          : EventStatus.DRAFT
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/leads`);
  revalidatePath("/");
  revalidatePath(`/evento/${parsed.data.slug}`);
  revalidatePath(`/lista/${parsed.data.slug}`);
  revalidatePath(`/lista/${parsed.data.slug}/obrigado`);
  redirect(`/admin/events/${eventId}`);
}

export async function updateEventStatusAction(formData: FormData) {
  await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!eventId) {
    redirect(`/admin/events?eventError=${encodeURIComponent("Evento não informado.")}`);
  }

  await requireEventAccess(eventId);

  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "UNPUBLISHED") {
    redirect(`/admin/events/${eventId}?eventError=${encodeURIComponent("Status inválido para esta ação.")}`);
  }

  try {
    await updateEventStatus(eventId, status);
  } catch (error) {
    redirect(`/admin/events/${eventId}?eventError=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível atualizar o evento.")}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/");
  if (eventSlug) {
    revalidatePath(`/evento/${eventSlug}`);
    revalidatePath(`/lista/${eventSlug}`);
    revalidatePath(`/lista/${eventSlug}/obrigado`);
  }
  redirect(`/admin/events/${eventId}?eventSaved=1`);
}

export async function duplicateEventAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();

  if (!eventId) {
    redirect(`/admin/events?eventError=${encodeURIComponent("Evento não informado.")}`);
  }

  await requireEventAccess(eventId);

  let duplicatedEvent: Awaited<ReturnType<typeof duplicateEvent>>;

  try {
    duplicatedEvent = await duplicateEvent(eventId);
  } catch (error) {
    redirect(`/admin/events/${eventId}?eventError=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível duplicar o evento.")}`);
  }

  await createAuditLog({
    adminUserId: admin.id,
    action: "EVENT_DUPLICATED",
    entityType: "Event",
    entityId: duplicatedEvent.id,
    metadata: {
      sourceEventId: eventId,
      title: duplicatedEvent.title,
      slug: duplicatedEvent.slug
    }
  });

  revalidatePath("/admin/events");
  revalidatePath("/admin/audit");
  revalidatePath("/");
  revalidatePath(`/evento/${duplicatedEvent.slug}`);
  revalidatePath(`/lista/${duplicatedEvent.slug}`);
  revalidatePath(`/lista/${duplicatedEvent.slug}/obrigado`);
  redirect(`/admin/events/${duplicatedEvent.id}`);
}
