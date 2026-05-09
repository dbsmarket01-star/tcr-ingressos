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

function checkoutValidationField(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ path?: Array<string | number>; message?: string }>;
    return issues[0]?.path?.join(".");
  }

  return undefined;
}

function hasSelectedTickets(formData: FormData, lotIds: string[]) {
  return lotIds.some((lotId) => Number(formData.get(`quantity_${lotId}`) ?? 0) > 0);
}

function addQueryParam(params: URLSearchParams, key: string, value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (text) {
    params.set(key, text);
  }
}

function buildCheckoutReturnUrl(formData: FormData, eventSlug: string, message: string) {
  const params = new URLSearchParams();
  const lotIds = formData.getAll("lotId").map(String);

  params.set("checkoutError", message);
  addQueryParam(params, "utm_source", formData.get("utmSource"));
  addQueryParam(params, "utm_medium", formData.get("utmMedium"));
  addQueryParam(params, "utm_campaign", formData.get("utmCampaign"));
  addQueryParam(params, "utm_content", formData.get("utmContent"));
  addQueryParam(params, "utm_term", formData.get("utmTerm"));
  addQueryParam(params, "ref", formData.get("referrer"));
  addQueryParam(params, "landingPage", formData.get("landingPage"));

  lotIds.forEach((lotId) => {
    const quantity = String(formData.get(`quantity_${lotId}`) ?? "0").trim();

    params.append("lotId", lotId);
    params.set(`quantity_${lotId}`, quantity || "0");
  });

  return `/evento/${eventSlug}/checkout?${params.toString()}#cadastro`;
}

function buildEventReturnUrl(eventSlug: string, message: string) {
  return `/evento/${eventSlug || ""}?checkoutError=${encodeURIComponent(message)}#ingressos`;
}

export async function createCheckoutOrderAction(formData: FormData) {
  const lotIds = formData.getAll("lotId").map(String);
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || "local";
  const userAgent = headerStore.get("user-agent")?.trim() || undefined;

  try {
    assertRateLimit(`checkout:${ip}`, { limit: 15, windowMs: 60_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aguarde alguns instantes e tente novamente.";
    redirect(
      eventSlug && hasSelectedTickets(formData, lotIds)
        ? buildCheckoutReturnUrl(formData, eventSlug, message)
        : buildEventReturnUrl(eventSlug, message)
    );
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
    metaFbp: String(formData.get("metaFbp") ?? "").trim() || undefined,
    metaFbc: String(formData.get("metaFbc") ?? "").trim() || undefined,
    clientIpAddress: ip,
    clientUserAgent: userAgent,
    items: lotIds.map((lotId) => ({
      lotId,
      quantity: Number(formData.get(`quantity_${lotId}`) ?? 0)
    }))
  });

  if (!parsed.success) {
    const message = checkoutValidationMessage(parsed.error);
    const field = checkoutValidationField(parsed.error);

    redirect(
      eventSlug && field !== "items" && hasSelectedTickets(formData, lotIds)
        ? buildCheckoutReturnUrl(formData, eventSlug, message)
        : buildEventReturnUrl(eventSlug, message)
    );
  }

  let order: Awaited<ReturnType<typeof createCheckoutOrder>>;

  try {
    const organizationContext = await getCurrentOrganizationContext();
    order = await createCheckoutOrder(parsed.data, organizationContext.organization.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o pedido. Tente novamente.";
    redirect(buildCheckoutReturnUrl(formData, eventSlug || parsed.data.eventSlug, message));
  }

  if (order.event.autoPendingPaymentEmailEnabled !== false) {
    try {
      await sendOrderPendingPaymentEmail({
        to: order.customer.email,
        buyerName: order.customer.name,
        orderCode: order.code,
        brandName: order.event.organization?.name || "Ingresaas",
        eventTitle: order.event.title,
        eventDate: order.event.startsAt,
        venueName: order.event.venueName,
      totalInCents: order.totalInCents,
      expiresAt: order.expiresAt,
      orderUrl: createPublicOrderUrl(order.code, order.event.organization)
    });
  } catch (error) {
      console.error("[email] Falha ao enviar pedido pendente", error);
    }
  }

  redirect(`/pedido/${order.code}`);
}
