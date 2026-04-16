"use server";

import { CouponStatus, CouponType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePercentageToBps } from "@/features/pricing/pricing";
import { couponSchema } from "./coupon.schema";
import { createCoupon, updateCouponStatus } from "./coupon.service";

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function couponErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.includes("Unique constraint")) {
    return "Ja existe um cupom com este codigo neste evento.";
  }

  return error instanceof Error ? error.message : fallback;
}

export async function createCouponAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const type = String(formData.get("type") ?? CouponType.PERCENTAGE) as CouponType;
  const fixedAmount = Number(formData.get("amount") ?? 0);

  const parsed = couponSchema.safeParse({
    eventId,
    code: String(formData.get("code") ?? "").trim(),
    type,
    status: String(formData.get("status") ?? CouponStatus.ACTIVE),
    percentage: type === CouponType.PERCENTAGE ? Math.round(parsePercentageToBps(formData.get("percentage")) / 100) : undefined,
    amountInCents: type === CouponType.FIXED_AMOUNT ? Math.round(fixedAmount * 100) : undefined,
    maxRedemptions: Number(formData.get("maxRedemptions") ?? 0) || undefined,
    startsAt: optionalDate(formData.get("startsAt")),
    endsAt: optionalDate(formData.get("endsAt"))
  });

  if (!parsed.success) {
    redirect(`/admin/events/${eventId}?couponError=${encodeURIComponent("Verifique os dados do cupom.")}`);
  }

  try {
    await createCoupon(parsed.data);
  } catch (error) {
    redirect(`/admin/events/${eventId}?couponError=${encodeURIComponent(couponErrorMessage(error, "Nao foi possivel salvar o cupom."))}`);
  }

  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?couponSaved=1`);
}

export async function updateCouponStatusAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const couponId = String(formData.get("couponId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!eventId || !couponId) {
    redirect(`/admin/events/${eventId || ""}?couponError=${encodeURIComponent("Cupom nao informado.")}`);
  }

  if (status !== CouponStatus.ACTIVE && status !== CouponStatus.PAUSED && status !== CouponStatus.EXPIRED) {
    redirect(`/admin/events/${eventId}?couponError=${encodeURIComponent("Status invalido para o cupom.")}`);
  }

  try {
    await updateCouponStatus(couponId, status as CouponStatus);
  } catch (error) {
    redirect(`/admin/events/${eventId}?couponError=${encodeURIComponent(couponErrorMessage(error, "Nao foi possivel atualizar o cupom."))}`);
  }

  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?couponSaved=1`);
}
