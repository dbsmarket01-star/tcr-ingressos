"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertRateLimit } from "@/features/security/rate-limit";
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
      holderName: "Informe o nome do titular como aparece no cartao.",
      number: "Informe um numero de cartao valido.",
      expiryMonth: "Informe o mes de validade do cartao.",
      expiryYear: "Informe o ano de validade do cartao.",
      ccv: "Informe o CVV do cartao.",
      holderCpfCnpj: "Informe o CPF/CNPJ do titular.",
      holderPostalCode: "Informe o CEP do titular.",
      holderAddressNumber: "Informe o numero do endereco do titular.",
      installments: "Escolha uma quantidade de parcelas valida."
    };

    if (field && messages[field]) {
      return messages[field];
    }
  }

  return "Preencha os dados do cartao corretamente.";
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
    throw new Error("Pedido nao informado.");
  }

  let checkoutUrl: string | null | undefined = null;

  try {
    const ip = await getActionIp();
    assertRateLimit(`payment-start:${ip}:${orderCode}`, { limit: 10, windowMs: 60_000 });
    const payment = await startPaymentForOrder(orderCode);
    checkoutUrl = payment.checkoutUrl;
    revalidatePath(`/pedido/${orderCode}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel iniciar o pagamento.";
    redirect(`/pedido/${orderCode}?paymentError=${encodeURIComponent(message)}`);
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(`/pedido/${orderCode}`);
}

export async function approveSimulatedPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido nao informado.");
  }

  await approvePaymentByOrderCode(orderCode);
  revalidatePath(`/pedido/${orderCode}`);
  revalidatePath("/admin/events");
}

export async function failSimulatedPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido nao informado.");
  }

  await failPaymentByOrderCode(orderCode);
  revalidatePath(`/pedido/${orderCode}`);
  revalidatePath("/admin/events");
}

export async function syncAsaasPaymentAction(formData: FormData) {
  const orderCode = String(formData.get("orderCode") ?? "").trim();

  if (!orderCode) {
    throw new Error("Pedido nao informado.");
  }

  try {
    await syncAsaasPaymentByOrderCode(orderCode);
    revalidatePath(`/pedido/${orderCode}`);
    revalidatePath("/admin/events");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/tickets");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel verificar o pagamento.";
    redirect(`/pedido/${orderCode}?paymentError=${encodeURIComponent(message)}`);
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
    redirect(`/pedido/${orderCode}?paymentError=${encodeURIComponent(creditCardValidationMessage(parsed.error))}`);
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
    const message = error instanceof Error ? error.message : "Nao foi possivel pagar com cartao.";
    redirect(`/pedido/${parsed.data.orderCode}?paymentError=${encodeURIComponent(message)}`);
  }

  redirect(`/pedido/${parsed.data.orderCode}`);
}
