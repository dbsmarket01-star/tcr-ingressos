"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { parseMoneyToCents } from "@/features/pricing/pricing";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { createManualSale, type ManualSalePaymentMethod } from "./manual-sale.service";

function requiredText(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) ?? "").trim();

  if (!value) {
    throw new Error(`Informe ${label}.`);
  }

  return value;
}

function optionalText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim() || null;
}

function parseQuantity(value: FormDataEntryValue | null) {
  const quantity = Number.parseInt(String(value ?? "1"), 10);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) {
    throw new Error("Informe uma quantidade entre 1 e 200.");
  }

  return quantity;
}

function parseDateTime(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error("Informe a data da venda.");
  }

  const date = new Date(text.length === 16 ? `${text}:00-03:00` : text);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Informe uma data de venda valida.");
  }

  return date;
}

function parseBirthDate(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  const date = new Date(`${text}T00:00:00.000Z`);

  if (!text || Number.isNaN(date.getTime())) {
    throw new Error(`Informe ${label}.`);
  }

  return date;
}

function parseOptionalMoney(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  return parseMoneyToCents(text);
}

function parsePaymentMethod(value: FormDataEntryValue | null): ManualSalePaymentMethod {
  const method = String(value ?? "LEGACY").trim();

  if (
    method === "PIX" ||
    method === "CREDIT_CARD" ||
    method === "CASH" ||
    method === "TRANSFER" ||
    method === "OTHER" ||
    method === "LEGACY"
  ) {
    return method;
  }

  return "LEGACY";
}

export async function createManualSaleAction(formData: FormData) {
  const admin = await requirePermission("ORDERS");
  const quantity = parseQuantity(formData.get("quantity"));
  const hotelGuestCount = Number.parseInt(String(formData.get("hotelGuestCount") ?? "0"), 10);
  const returnTo = "/admin/manual-sales";
  let result: Awaited<ReturnType<typeof createManualSale>> | null = null;

  try {
    const hotelGuests = Array.from({ length: Number.isFinite(hotelGuestCount) ? hotelGuestCount : 0 }, (_, index) => {
      const guestIndex = index + 1;
      const prefix = `guest${guestIndex}`;

      return {
        guestIndex,
        guest1Name: requiredText(formData, `${prefix}Guest1Name`, `o nome do hospede principal ${guestIndex}`),
        guest1Document: requiredText(formData, `${prefix}Guest1Document`, `o CPF do hospede principal ${guestIndex}`),
        guest1BirthDate: parseBirthDate(
          formData.get(`${prefix}Guest1BirthDate`),
          `a data de nascimento do hospede principal ${guestIndex}`
        ),
        guest1Email: requiredText(formData, `${prefix}Guest1Email`, `o e-mail do hospede principal ${guestIndex}`),
        guest1Phone: requiredText(formData, `${prefix}Guest1Phone`, `o telefone do hospede principal ${guestIndex}`),
        guest2Name: requiredText(formData, `${prefix}Guest2Name`, `o nome do acompanhante ${guestIndex}`),
        guest2Document: requiredText(formData, `${prefix}Guest2Document`, `o CPF do acompanhante ${guestIndex}`),
        guest2BirthDate: parseBirthDate(
          formData.get(`${prefix}Guest2BirthDate`),
          `a data de nascimento do acompanhante ${guestIndex}`
        )
      };
    });

    result = await createManualSale(
      {
        eventId: requiredText(formData, "eventId", "o evento"),
        lotId: requiredText(formData, "lotId", "o ingresso/lote"),
        lotOptionId: optionalText(formData, "lotOptionId"),
        quantity,
        buyerName: requiredText(formData, "buyerName", "o nome do comprador"),
        buyerEmail: requiredText(formData, "buyerEmail", "o e-mail do comprador"),
        buyerDocument: optionalText(formData, "buyerDocument"),
        buyerPhone: optionalText(formData, "buyerPhone"),
        churchName: optionalText(formData, "churchName"),
        paidAt: parseDateTime(formData.get("paidAt")),
        totalPaidInCents: parseOptionalMoney(formData.get("totalPaid")),
        serviceFeeInCents: parseOptionalMoney(formData.get("serviceFee")),
        paymentMethod: parsePaymentMethod(formData.get("paymentMethod")),
        sourceLabel: optionalText(formData, "sourceLabel"),
        internalNotes: optionalText(formData, "internalNotes"),
        hotelGuests
      },
      admin.organizationId,
      getAdminAllowedEventIds(admin),
      admin.id
    );
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível registrar a venda manual.");
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
  }

  if (!result) {
    redirect(`${returnTo}?error=${encodeURIComponent("Não foi possível registrar a venda manual.")}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/manual-sales");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/events");
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/home-list");
  revalidatePath("/admin/audit");
  revalidatePath(`/evento/${result.eventSlug}`);

  redirect(`${returnTo}?created=${encodeURIComponent(result.orderCode)}&homeList=${result.homeListEntriesCreated}`);
}
