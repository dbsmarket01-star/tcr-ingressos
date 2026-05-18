"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { resendPendingPaymentEmailByOrderCode, resendTicketsEmailByOrderCode } from "./support.service";

export async function resendTicketsEmailAction(formData: FormData) {
  const admin = await requirePermission("SUPPORT");
  const orderCode = String(formData.get("orderCode") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  try {
    const result = await resendTicketsEmailByOrderCode(orderCode, admin.organizationId, getAdminAllowedEventIds(admin));
    params.set("sent", result.email);
    params.set("order", result.orderCode);
  } catch (error) {
    params.set("error", getFriendlyErrorMessage(error, "Não foi possível reenviar o e-mail."));
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?${params.toString()}`);
}

export async function resendPendingPaymentEmailAction(formData: FormData) {
  const admin = await requirePermission("SUPPORT");
  const orderCode = String(formData.get("orderCode") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  try {
    const result = await resendPendingPaymentEmailByOrderCode(
      orderCode,
      admin.organizationId,
      getAdminAllowedEventIds(admin)
    );
    params.set("paymentSent", result.email);
    params.set("order", result.orderCode);
  } catch (error) {
    params.set("error", getFriendlyErrorMessage(error, "Não foi possível reenviar o link de pagamento."));
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?${params.toString()}`);
}
