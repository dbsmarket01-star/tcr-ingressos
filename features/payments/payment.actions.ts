"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertRateLimit } from "@/features/security/rate-limit";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { resendTicketsEmailByOrderCode } from "@/features/support/support.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import { creditCardPaymentSchema } from "./credit-card.schema";
import {
  approvePaymentByOrderCode,
  failPaymentByOrderCode,
  payOrderWithAsaasCreditCard,
  startPaymentForOrder,
  syncAsaasPaymentByOrderCode
} from "./payment.service";

function onlyDigits(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function creditCardValidationMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ path?: Array<string | number>; message?: string }>;
    const field = issues[0]?.path?.join(".");

    const messages: Record<string, string> = {
      holderName: "Informe o nome do titular como aparece no cartão.",
      number: "Informe um número de cartão válido.",
      expiryMonth: "Informe o mês de validade do cartão.",
      expiryYear: "Informe o ano de validade do cartão.",
      ccv: "Informe o CVV do cartão.",
      holderCpfCnpj: "Informe o CPF/CNPJ do titular.",
      holderPostalCode: "Informe o CEP do titular.",
      holderAddressNumber: "Informe o número do endereço do titular.",
      installments: "Escolha uma quantidade de parcelas válida."
    };

    if (field && messages[field]) {
      return messages[field];
    }
  }

  return "Preencha os dados do cartão corretamente.";
}

function paymentErrorRedirectPath(orderCode: string, message: string, method: "pix" | "card" = "card") {
  return `/pedido/${orderCode}?paymentError=${encodeURIComponent(message)}&paymentMethod=${method}#aviso-pagamento`;
}

function ticketEmailRedirectPath(orderCode: string, status: "sent" | "error", message?: string) {
  const params = new URLSearchParams({
    ticketEmail: status
  });

  if (message) {
    params.set("ticketEmailMessage", message);
  }

  return `/pedido/${orderCode}?${params.toString()}#ingressos`;
}

async function getActionIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local";
}

export async function startPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido não informado.");
  }

  let checkoutUrl: string | null | undefined = null;

  try {
    const ip = await getActionIp();
    assertRateLimit(`payment-start:${ip}:${orderCode}`, { limit: 10, windowMs: 60_000 });
    const payment = await startPaymentForOrder(orderCode);
    checkoutUrl = payment.checkoutUrl;
    revalidatePath(`/pedido/${orderCode}`);
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível iniciar o pagamento.");
    redirect(paymentErrorRedirectPath(orderCode, message, "pix"));
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(`/pedido/${orderCode}`);
}

export async function approveSimulatedPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido não informado.");
  }

  await approvePaymentByOrderCode(orderCode);
  revalidatePath(`/pedido/${orderCode}`);
  revalidatePath("/admin/events");
}

export async function failSimulatedPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido não informado.");
  }

  await failPaymentByOrderCode(orderCode);
  revalidatePath(`/pedido/${orderCode}`);
  revalidatePath("/admin/events");
}

export async function syncAsaasPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido não informado.");
  }

  try {
    await syncAsaasPaymentByOrderCode(orderCode);
    revalidatePath(`/pedido/${orderCode}`);
    revalidatePath("/admin/events");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/tickets");
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível verificar o pagamento.");
    redirect(paymentErrorRedirectPath(orderCode, message, "pix"));
  }

  redirect(`/pedido/${orderCode}`);
}

export async function payWithCreditCardAction(formData: FormData) {
  const parsed = creditCardPaymentSchema.safeParse({
    orderCode: String(formData.get("orderCode") ?? "").trim(),
    holderName: String(formData.get("holderName") ?? "").trim(),
    number: onlyDigits(formData.get("number")),
    expiryMonth: onlyDigits(formData.get("expiryMonth")),
    expiryYear: onlyDigits(formData.get("expiryYear")),
    ccv: onlyDigits(formData.get("ccv")),
    holderCpfCnpj: onlyDigits(formData.get("holderCpfCnpj")),
    holderPostalCode: onlyDigits(formData.get("holderPostalCode")),
    holderAddressNumber: String(formData.get("holderAddressNumber") ?? "").trim(),
    holderAddressComplement: String(formData.get("holderAddressComplement") ?? "").trim() || undefined,
    installments: Number(formData.get("installments") ?? 1)
  });

  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!parsed.success) {
    redirect(paymentErrorRedirectPath(orderCode, creditCardValidationMessage(parsed.error), "card"));
  }

  const remoteIp = await getActionIp();

  try {
    assertRateLimit(`card:${remoteIp}:${parsed.data.orderCode}`, { limit: 6, windowMs: 10 * 60_000 });
    await payOrderWithAsaasCreditCard({
      ...parsed.data,
      remoteIp
    });
    revalidatePath(`/pedido/${parsed.data.orderCode}`);
    revalidatePath("/admin/events");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/tickets");
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível pagar com cartão.");
    redirect(paymentErrorRedirectPath(parsed.data.orderCode, message, "card"));
  }

  redirect(`/pedido/${parsed.data.orderCode}`);
}

export async function resendApprovedTicketsEmailAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido não informado.");
  }

  let redirectPath = "";

  try {
    const ip = await getActionIp();
    assertRateLimit(`ticket-email-resend:${ip}:${orderCode}`, { limit: 3, windowMs: 10 * 60_000 });
    const organizationContext = await getCurrentOrganizationContext();
    const result = await resendTicketsEmailByOrderCode(orderCode, organizationContext.organization.id);
    revalidatePath(`/pedido/${orderCode}`);
    redirectPath = ticketEmailRedirectPath(orderCode, "sent", `Ingressos reenviados para ${result.email}.`);
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível reenviar os ingressos por e-mail.");
    redirectPath = ticketEmailRedirectPath(orderCode, "error", message);
  }

  redirect(redirectPath);
}
