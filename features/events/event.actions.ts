"use server";

import { EventStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEvent, duplicateEvent, updateEvent, updateEventStatus } from "./event.service";
import { eventDraftSchema } from "./event.schema";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
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
        bannerUrl: "URL do banner",
        bannerPosition: "Enquadramento do banner",
        eventMapImageUrl: "Mapa do evento",
        eventMapTemplate: "Modelo do mapa",
        eventMapNotes: "Observações do mapa",
        metaPixelId: "Meta Pixel ID",
        googleTagManagerId: "Google Tag Manager ID",
        seoTitle: "Título SEO",
        seoDescription: "Descrição SEO",
        seoImageUrl: "Imagem SEO",
        supportWhatsappUrl: "Link do WhatsApp",
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
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");
  const slug = slugify(rawSlug || title);
  let bannerUploadUrl: string | null = null;
  let mapUploadUrl: string | null = null;
  let seoUploadUrl: string | null = null;

  try {
    bannerUploadUrl = await savePublicImageUpload(formData.get("bannerFile") as File | null, `events/${slug}/banner`);
    mapUploadUrl = await savePublicImageUpload(formData.get("eventMapFile") as File | null, `events/${slug}/map`);
    seoUploadUrl = await savePublicImageUpload(formData.get("seoImageFile") as File | null, `events/${slug}/seo`);
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
    eventMapImageUrl: mapUploadUrl || String(formData.get("eventMapImageUrl") ?? "").trim(),
    eventMapTemplate: String(formData.get("eventMapTemplate") ?? "AUTO"),
    eventMapNotes: String(formData.get("eventMapNotes") ?? "").trim() || undefined,
    importantInfo: String(formData.get("importantInfo") ?? "").trim() || undefined,
    metaPixelId: String(formData.get("metaPixelId") ?? "").trim() || undefined,
    googleTagManagerId: String(formData.get("googleTagManagerId") ?? "").trim() || undefined,
    seoTitle: String(formData.get("seoTitle") ?? "").trim() || undefined,
    seoDescription: String(formData.get("seoDescription") ?? "").trim() || undefined,
    seoKeywords: String(formData.get("seoKeywords") ?? "").trim() || undefined,
    seoImageUrl: seoUploadUrl || String(formData.get("seoImageUrl") ?? "").trim(),
    supportWhatsappUrl: String(formData.get("supportWhatsappUrl") ?? "").trim() || undefined,
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
    status: status === "PUBLISHED" ? EventStatus.PUBLISHED : EventStatus.DRAFT
  });

  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function updateEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");

  if (!eventId) {
    throw new Error("Evento não informado.");
  }

  const slug = slugify(rawSlug || title);
  let bannerUploadUrl: string | null = null;
  let mapUploadUrl: string | null = null;
  let seoUploadUrl: string | null = null;

  try {
    bannerUploadUrl = await savePublicImageUpload(formData.get("bannerFile") as File | null, `events/${slug}/banner`);
    mapUploadUrl = await savePublicImageUpload(formData.get("eventMapFile") as File | null, `events/${slug}/map`);
    seoUploadUrl = await savePublicImageUpload(formData.get("seoImageFile") as File | null, `events/${slug}/seo`);
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
    bannerUrl: bannerUploadUrl || String(formData.get("bannerUrl") ?? "").trim(),
    bannerPosition: String(formData.get("bannerPosition") ?? "center center"),
    eventMapImageUrl: mapUploadUrl || String(formData.get("eventMapImageUrl") ?? "").trim(),
    eventMapTemplate: String(formData.get("eventMapTemplate") ?? "AUTO"),
    eventMapNotes: String(formData.get("eventMapNotes") ?? "").trim() || undefined,
    importantInfo: String(formData.get("importantInfo") ?? "").trim() || undefined,
    metaPixelId: String(formData.get("metaPixelId") ?? "").trim() || undefined,
    googleTagManagerId: String(formData.get("googleTagManagerId") ?? "").trim() || undefined,
    seoTitle: String(formData.get("seoTitle") ?? "").trim() || undefined,
    seoDescription: String(formData.get("seoDescription") ?? "").trim() || undefined,
    seoKeywords: String(formData.get("seoKeywords") ?? "").trim() || undefined,
    seoImageUrl: seoUploadUrl || String(formData.get("seoImageUrl") ?? "").trim(),
    supportWhatsappUrl: String(formData.get("supportWhatsappUrl") ?? "").trim() || undefined,
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
    status: status === "PUBLISHED" ? EventStatus.PUBLISHED : EventStatus.DRAFT
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}

export async function updateEventStatusAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!eventId) {
    redirect(`/admin/events?eventError=${encodeURIComponent("Evento não informado.")}`);
  }

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
  redirect(`/admin/events/${eventId}?eventSaved=1`);
}

export async function duplicateEventAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();

  if (!eventId) {
    redirect(`/admin/events?eventError=${encodeURIComponent("Evento não informado.")}`);
  }

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
  redirect(`/admin/events/${duplicatedEvent.id}`);
}
