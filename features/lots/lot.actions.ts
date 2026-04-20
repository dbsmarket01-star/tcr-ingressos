"use server";

import { LotStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseInstallmentStart, parseMoneyToCents, parsePercentageToBps } from "@/features/pricing/pricing";
import { createTicketLot, updateTicketLot, updateTicketLotPricing, updateTicketLotStatus } from "./lot.service";
import { ticketLotPricingSchema, ticketLotSchema } from "./lot.schema";

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function lotErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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

export async function createTicketLotAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const status = String(formData.get("status") ?? "DRAFT");

  const parsed = ticketLotSchema.safeParse({
    eventId,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    priceInCents: Math.round(price * 100),
    serviceFeeBps: parsePercentageToBps(formData.get("serviceFeePercent")),
    ...parsePixDiscount(formData),
    cardInterestBpsPerInstallment: parsePercentageToBps(formData.get("cardInterestPercentPerInstallment")),
    cardInterestStartsAtInstallment: parseInstallmentStart(formData.get("cardInterestStartsAtInstallment")),
    totalQuantity: Number(formData.get("totalQuantity") ?? 0),
    minPerOrder: Number(formData.get("minPerOrder") ?? 1),
    maxPerOrder: Number(formData.get("maxPerOrder") ?? 10),
    salesStartsAt: optionalDate(formData.get("salesStartsAt")),
    salesEndsAt: optionalDate(formData.get("salesEndsAt"))
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}?lotError=${encodeURIComponent("Verifique os campos obrigatórios do lote.")}`);
  }

  try {
    await createTicketLot({
      ...parsed.data,
      status: status === "ACTIVE" ? LotStatus.ACTIVE : LotStatus.DRAFT
    });
  } catch (error) {
    redirect(`/admin/events/${eventId}?lotError=${encodeURIComponent(lotErrorMessage(error, "Não foi possível salvar o lote."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?lotSaved=1`);
}

export async function updateTicketLotStatusAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!eventId || !lotId) {
    redirect(`/admin/events/${eventId || ""}?lotError=${encodeURIComponent("Lote não informado.")}`);
  }

  if (status !== "ACTIVE" && status !== "PAUSED" && status !== "CLOSED" && status !== "DRAFT") {
    redirect(`/admin/events/${eventId}?lotError=${encodeURIComponent("Status inválido para este lote.")}`);
  }

  try {
    await updateTicketLotStatus(lotId, status);
  } catch (error) {
    redirect(`/admin/events/${eventId}?lotError=${encodeURIComponent(lotErrorMessage(error, "Não foi possível atualizar o status do lote."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?lotSaved=1`);
}

export async function updateTicketLotPricingAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);

  if (!eventId || !lotId) {
    redirect(`/admin/events/${eventId || ""}?lotError=${encodeURIComponent("Lote não informado.")}`);
  }

  const parsed = ticketLotPricingSchema.safeParse({
      priceInCents: Math.round(price * 100),
      serviceFeeBps: parsePercentageToBps(formData.get("serviceFeePercent")),
      ...parsePixDiscount(formData),
      cardInterestBpsPerInstallment: parsePercentageToBps(formData.get("cardInterestPercentPerInstallment")),
      cardInterestStartsAtInstallment: parseInstallmentStart(formData.get("cardInterestStartsAtInstallment"))
    });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}?lotError=${encodeURIComponent("Verifique preço, taxa e juros do lote.")}`);
  }

  try {
    await updateTicketLotPricing(lotId, parsed.data);
  } catch (error) {
    redirect(`/admin/events/${eventId}?lotError=${encodeURIComponent(lotErrorMessage(error, "Não foi possível atualizar preço e taxas do lote."))}`);
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/evento/${String(formData.get("eventSlug") ?? "").trim()}`);
  redirect(`/admin/events/${eventId}?lotSaved=1`);
}

export async function updateTicketLotAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const status = String(formData.get("status") ?? "DRAFT");

  if (!eventId || !lotId) {
    redirect(`/admin/events/${eventId || ""}/lots/${lotId || ""}/edit?error=${encodeURIComponent("Lote não informado.")}`);
  }

  const parsed = ticketLotSchema.safeParse({
    eventId,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    priceInCents: Math.round(price * 100),
    serviceFeeBps: parsePercentageToBps(formData.get("serviceFeePercent")),
    ...parsePixDiscount(formData),
    cardInterestBpsPerInstallment: parsePercentageToBps(formData.get("cardInterestPercentPerInstallment")),
    cardInterestStartsAtInstallment: parseInstallmentStart(formData.get("cardInterestStartsAtInstallment")),
    totalQuantity: Number(formData.get("totalQuantity") ?? 0),
    minPerOrder: Number(formData.get("minPerOrder") ?? 1),
    maxPerOrder: Number(formData.get("maxPerOrder") ?? 10),
    salesStartsAt: optionalDate(formData.get("salesStartsAt")),
    salesEndsAt: optionalDate(formData.get("salesEndsAt"))
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}/lots/${lotId}/edit?error=${encodeURIComponent("Verifique os campos obrigatórios do lote.")}`);
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
  revalidatePath(`/evento/${eventSlug}`);
  redirect(`/admin/events/${eventId}`);
}
