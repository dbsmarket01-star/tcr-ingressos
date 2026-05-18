"use server";

import { LotStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { parseInstallmentStart, parseMoneyToCents, parsePercentageToBps } from "@/features/pricing/pricing";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { createTicketLot, updateTicketLot, updateTicketLotPricing, updateTicketLotStatus } from "./lot.service";
import { ticketLotPricingSchema, ticketLotSchema } from "./lot.schema";

function optionalInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? Number(text) : undefined;
}

function parseHotelFields(formData: FormData) {
  return {
    hasHotel: String(formData.get("hasHotel") ?? "false") === "true",
    hotelId: String(formData.get("hotelId") ?? "").trim() || undefined,
    newHotelName: String(formData.get("newHotelName") ?? "").trim() || undefined,
    newHotelCity: String(formData.get("newHotelCity") ?? "").trim() || undefined,
    newHotelState: String(formData.get("newHotelState") ?? "").trim().toUpperCase() || undefined,
    newHotelInternalNotes: String(formData.get("newHotelInternalNotes") ?? "").trim() || undefined,
    newHotelAvailableRooms: optionalInt(formData.get("newHotelAvailableRooms"))
  };
}

function lotErrorMessage(error: unknown, fallback: string) {
  return getFriendlyErrorMessage(error, fallback);
}

function validationErrorMessage(
  result: { error?: { issues?: Array<{ message?: string }> } },
  fallback: string
) {
  return result.error?.issues?.[0]?.message || fallback;
}

function parsePixDiscount(formData: FormData) {
  const type = String(formData.get("pixDiscountType") ?? "NONE").trim();

  if (type === "PERCENTAGE") {
    return {
      pixDiscountPercentBps: parsePercentageToBps(formData.get("pixDiscountPercent")),
      pixDiscountFixedInCents: 0
    };
  }

  if (type === "FIXED") {
    return {
      pixDiscountPercentBps: 0,
      pixDiscountFixedInCents: parseMoneyToCents(formData.get("pixDiscountFixed"))
    };
  }

  return {
    pixDiscountPercentBps: 0,
    pixDiscountFixedInCents: 0
  };
}

function parseHighlightColor(formData: FormData) {
  return String(formData.get("highlightColor") ?? "").trim() || undefined;
}

export async function createTicketLotAction(formData: FormData) {
  await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const status = String(formData.get("status") ?? "DRAFT");

  const parsed = ticketLotSchema.safeParse({
    eventId,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    highlightColor: parseHighlightColor(formData),
    descriptionAsList: String(formData.get("descriptionAsList") ?? "false") === "true",
    churchQuestionEnabled: String(formData.get("churchQuestionEnabled") ?? "false") === "true",
    hasTypeOptions: String(formData.get("hasTypeOptions") ?? "false") === "true",
    admissionsPerUnit: Number(formData.get("admissionsPerUnit") ?? 1),
    typeOptionsText: String(formData.get("typeOptionsText") ?? "").trim() || undefined,
    ...parseHotelFields(formData),
    priceInCents: Math.round(price * 100),
    serviceFeeBps: parsePercentageToBps(formData.get("serviceFeePercent")),
    ...parsePixDiscount(formData),
    cardInterestBpsPerInstallment: parsePercentageToBps(formData.get("cardInterestPercentPerInstallment")),
    cardInterestStartsAtInstallment: parseInstallmentStart(formData.get("cardInterestStartsAtInstallment")),
    totalQuantity: Number(formData.get("totalQuantity") ?? 0),
    minPerOrder: Number(formData.get("minPerOrder") ?? 1),
    maxPerOrder: Number(formData.get("maxPerOrder") ?? 10)
  });

  if (!parsed.success) {
    redirect(
      `/admin/events/${eventId}/lots?lotError=${encodeURIComponent(
        validationErrorMessage(parsed, "Verifique os campos obrigatórios do lote.")
      )}`
    );
  }

  await requireEventAccess(eventId);

  try {
    await createTicketLot({
      ...parsed.data,
      status: status === "ACTIVE" ? LotStatus.ACTIVE : LotStatus.DRAFT
    });
  } catch (error) {
    redirect(`/admin/events/${eventId}/lots?lotError=${encodeURIComponent(lotErrorMessage(error, "Não foi possível salvar o lote."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/lots`);
  redirect(`/admin/events/${eventId}/lots?lotSaved=1`);
}

export async function updateTicketLotStatusAction(formData: FormData) {
  await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!eventId || !lotId) {
    redirect(`/admin/events/${eventId || ""}/lots?lotError=${encodeURIComponent("Lote não informado.")}`);
  }

  await requireEventAccess(eventId);

  if (status !== "ACTIVE" && status !== "PAUSED" && status !== "CLOSED" && status !== "DRAFT") {
    redirect(`/admin/events/${eventId}/lots?lotError=${encodeURIComponent("Status inválido para este lote.")}`);
  }

  try {
    await updateTicketLotStatus(lotId, status as LotStatus);
  } catch (error) {
    redirect(`/admin/events/${eventId}/lots?lotError=${encodeURIComponent(lotErrorMessage(error, "Não foi possível atualizar o status do lote."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/lots`);
  revalidatePath("/");

  if (eventSlug) {
    revalidatePath(`/evento/${eventSlug}`);
  }

  const statusMessage = status === "PAUSED" ? "paused" : status === "ACTIVE" ? "active" : "updated";
  redirect(`/admin/events/${eventId}/lots?lotStatus=${statusMessage}`);
}

export async function updateTicketLotPricingAction(formData: FormData) {
  await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);

  if (!eventId || !lotId) {
    redirect(`/admin/events/${eventId || ""}/lots?lotError=${encodeURIComponent("Lote não informado.")}`);
  }

  await requireEventAccess(eventId);

  const parsed = ticketLotPricingSchema.safeParse({
      priceInCents: Math.round(price * 100),
      serviceFeeBps: parsePercentageToBps(formData.get("serviceFeePercent")),
      ...parsePixDiscount(formData),
      cardInterestBpsPerInstallment: parsePercentageToBps(formData.get("cardInterestPercentPerInstallment")),
      cardInterestStartsAtInstallment: parseInstallmentStart(formData.get("cardInterestStartsAtInstallment"))
    });

  if (!parsed.success) {
    redirect(
      `/admin/events/${eventId}/lots?lotError=${encodeURIComponent(
        validationErrorMessage(parsed, "Verifique preço, taxa e juros do lote.")
      )}`
    );
  }

  try {
    await updateTicketLotPricing(lotId, parsed.data);
  } catch (error) {
    redirect(`/admin/events/${eventId}/lots?lotError=${encodeURIComponent(lotErrorMessage(error, "Não foi possível atualizar preço e taxas do lote."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/lots`);
  revalidatePath(`/evento/${String(formData.get("eventSlug") ?? "").trim()}`);
  redirect(`/admin/events/${eventId}/lots?lotSaved=1`);
}

export async function updateTicketLotAction(formData: FormData) {
  await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const status = String(formData.get("status") ?? "DRAFT");

  if (!eventId || !lotId) {
    redirect(`/admin/events/${eventId || ""}/lots/${lotId || ""}/edit?error=${encodeURIComponent("Lote não informado.")}`);
  }

  await requireEventAccess(eventId);

  const parsed = ticketLotSchema.safeParse({
    eventId,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    highlightColor: parseHighlightColor(formData),
    descriptionAsList: String(formData.get("descriptionAsList") ?? "false") === "true",
    churchQuestionEnabled: String(formData.get("churchQuestionEnabled") ?? "false") === "true",
    hasTypeOptions: String(formData.get("hasTypeOptions") ?? "false") === "true",
    admissionsPerUnit: Number(formData.get("admissionsPerUnit") ?? 1),
    typeOptionsText: String(formData.get("typeOptionsText") ?? "").trim() || undefined,
    ...parseHotelFields(formData),
    priceInCents: Math.round(price * 100),
    serviceFeeBps: parsePercentageToBps(formData.get("serviceFeePercent")),
    ...parsePixDiscount(formData),
    cardInterestBpsPerInstallment: parsePercentageToBps(formData.get("cardInterestPercentPerInstallment")),
    cardInterestStartsAtInstallment: parseInstallmentStart(formData.get("cardInterestStartsAtInstallment")),
    totalQuantity: Number(formData.get("totalQuantity") ?? 0),
    minPerOrder: Number(formData.get("minPerOrder") ?? 1),
    maxPerOrder: Number(formData.get("maxPerOrder") ?? 10)
  });

  if (!parsed.success) {
    redirect(
      `/admin/events/${eventId}/lots/${lotId}/edit?error=${encodeURIComponent(
        validationErrorMessage(parsed, "Verifique os campos obrigatórios do lote.")
      )}`
    );
  }

  if (
    status !== LotStatus.ACTIVE &&
    status !== LotStatus.PAUSED &&
    status !== LotStatus.CLOSED &&
    status !== LotStatus.DRAFT
  ) {
    redirect(`/admin/events/${eventId}/lots/${lotId}/edit?error=${encodeURIComponent("Status inválido para este lote.")}`);
  }

  try {
    await updateTicketLot(lotId, {
      ...parsed.data,
      status: status as LotStatus
    });
  } catch (error) {
    redirect(`/admin/events/${eventId}/lots/${lotId}/edit?error=${encodeURIComponent(lotErrorMessage(error, "Não foi possível atualizar o ingresso."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/lots`);
  revalidatePath(`/evento/${eventSlug}`);
  redirect(`/admin/events/${eventId}/lots?lotSaved=1`);
}
