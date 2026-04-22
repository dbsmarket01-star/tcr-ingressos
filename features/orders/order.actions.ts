"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createPublicOrderUrl, sendOrderPendingPaymentEmail } from "@/features/email/email.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { assertRateLimit } from "@/features/security/rate-limit";
import { checkoutOrderSchema } from "./order.schema";
import { createCheckoutOrder } from "./order.service";

function checkoutValidationMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ path?: Array<string | number>; message?: string }>;
    const firstIssue = issues[0];
    const field = firstIssue?.path?.join(".");

    if (field === "buyerName") {
      return "Preencha seu nome completo.";
    }

    if (field === "buyerEmail") {
      return "Preencha um e-mail válido.";
    }

    if (field === "buyerDocument") {
      return "Preencha seu CPF.";
    }

    if (field === "items") {
      return "Selecione pelo menos 1 ingresso.";
    }
  }

  return "Verifique comprador e ingressos selecionados.";
}

export async function createCheckoutOrderAction(formData: FormData) {
  const lotIds = formData.getAll("lotId").map(String);
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || "local";

  try {
    assertRateLimit(`checkout:${ip}`, { limit: 15, windowMs: 60_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aguarde alguns instantes e tente novamente.";
    redirect(`/evento/${eventSlug || ""}?checkoutError=${encodeURIComponent(message)}#ingressos`);
  }

  const parsed = checkoutOrderSchema.safeParse({
    eventId: String(formData.get("eventId") ?? "").trim(),
    eventSlug,
    buyerName: String(formData.get("buyerName") ?? "").trim(),
    buyerEmail: String(formData.get("buyerEmail") ?? "").trim(),
    buyerDocument: String(formData.get("buyerDocument") ?? "").trim(),
    buyerPhone: String(formData.get("buyerPhone") ?? "").trim() || undefined,
    couponCode: String(formData.get("coupon") ?? "").trim() || undefined,
    utmSource: String(formData.get("utmSource") ?? "").trim() || undefined,
    utmMedium: String(formData.get("utmMedium") ?? "").trim() || undefined,
    utmCampaign: String(formData.get("utmCampaign") ?? "").trim() || undefined,
    utmContent: String(formData.get("utmContent") ?? "").trim() || undefined,
    utmTerm: String(formData.get("utmTerm") ?? "").trim() || undefined,
    referrer: String(formData.get("referrer") ?? "").trim() || undefined,
    landingPage: String(formData.get("landingPage") ?? "").trim() || undefined,
    items: lotIds.map((lotId) => ({
      lotId,
      quantity: Number(formData.get(`quantity_${lotId}`) ?? 0)
    }))
  });

  if (!parsed.success) {
    redirect(`/evento/${eventSlug || ""}?checkoutError=${encodeURIComponent(checkoutValidationMessage(parsed.error))}#ingressos`);
  }

  let order: Awaited<ReturnType<typeof createCheckoutOrder>>;

  try {
    const organizationContext = await getCurrentOrganizationContext();
    order = await createCheckoutOrder(parsed.data, organizationContext.organization.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o pedido. Tente novamente.";
    redirect(`/evento/${eventSlug || parsed.data.eventSlug}?checkoutError=${encodeURIComponent(message)}#ingressos`);
  }

  try {
    await sendOrderPendingPaymentEmail({
      to: order.customer.email,
      buyerName: order.customer.name,
      orderCode: order.code,
      eventTitle: order.event.title,
      eventDate: order.event.startsAt,
      venueName: order.event.venueName,
      totalInCents: order.totalInCents,
      expiresAt: order.expiresAt,
      orderUrl: createPublicOrderUrl(order.code)
    });
  } catch (error) {
    console.error("[email] Falha ao enviar pedido pendente", error);
  }

  redirect(`/pedido/${order.code}`);
}
