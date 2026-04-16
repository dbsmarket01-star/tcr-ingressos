"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resendPendingPaymentEmailByOrderCode, resendTicketsEmailByOrderCode } from "./support.service";

export async function resendTicketsEmailAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  try {
    const result = await resendTicketsEmailByOrderCode(orderCode);
    params.set("sent", result.email);
    params.set("order", result.orderCode);
  } catch (error) {
    params.set("error", error instanceof Error ? error.message : "Nao foi possivel reenviar o e-mail.");
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?${params.toString()}`);
}

export async function resendPendingPaymentEmailAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  try {
    const result = await resendPendingPaymentEmailByOrderCode(orderCode);
    params.set("paymentSent", result.email);
    params.set("order", result.orderCode);
  } catch (error) {
    params.set("error", error instanceof Error ? error.message : "Nao foi possivel reenviar o link de pagamento.");
  }

  revalidatePath("/admin/support");
  redirect(`/admin/support?${params.toString()}`);
}
