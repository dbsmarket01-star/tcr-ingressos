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

    if (field?.startsWith("hotelGuests")) {
      return "Preencha os dados obrigatórios dos hóspedes.";
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

function parseHotelGuests(formData: FormData, lotIds: string[]) {
  const hotelGuests: Array<{
    lotId: string;
    guestIndex: number;
    guest1Name?: string;
    guest1Document?: string;
    guest1BirthDate?: string;
    guest1Email?: string;
    guest1Phone?: string;
    guest2Name?: string;
    guest2Document?: string;
    guest2BirthDate?: string;
  }> = [];

  lotIds.forEach((lotId) => {
    const quantity = Number(formData.get(`quantity_${lotId}`) ?? 0);

    for (let index = 1; index <= quantity; index += 1) {
      if (String(formData.get(`hotelGuest_${lotId}_${index}_enabled`) ?? "") !== "1") {
        continue;
      }

      const fieldName = (name: string) => `hotelGuest_${lotId}_${index}_${name}`;
      const text = (name: string) => String(formData.get(fieldName(name)) ?? "").trim() || undefined;

      hotelGuests.push({
        lotId,
        guestIndex: index,
        guest1Name: text("guest1Name"),
        guest1Document: text("guest1Document"),
        guest1BirthDate: text("guest1BirthDate"),
        guest1Email: text("guest1Email"),
        guest1Phone: text("guest1Phone"),
        guest2Name: text("guest2Name"),
        guest2Document: text("guest2Document"),
        guest2BirthDate: text("guest2BirthDate")
      });
    }
  });

  return hotelGuests;
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
    hotelGuests: parseHotelGuests(formData, lotIds),
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
        brandPrimaryColor: order.event.organization?.primaryColor,
        organization: order.event.organization,
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
