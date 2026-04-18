import { NextResponse } from "next/server";
import { handlePaymentWebhook, syncAsaasPaymentByExternalId } from "@/features/payments/payment.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

type AsaasWebhookPayload = {
  event?: string;
  token?: string;
  accessToken?: string;
  payment?: {
    id?: string;
    status?: string;
    externalReference?: string;
  };
};

function mapAsaasStatus(event?: string, status?: string) {
  if (
    event === "PAYMENT_CONFIRMED" ||
    event === "PAYMENT_RECEIVED" ||
    status === "CONFIRMED" ||
    status === "RECEIVED"
  ) {
    return "APPROVED" as const;
  }

  if (
    event === "PAYMENT_DELETED" ||
    event === "PAYMENT_REFUNDED" ||
    event === "PAYMENT_REFUND_IN_PROGRESS" ||
    status === "REFUNDED"
  ) {
    return "CANCELED" as const;
  }

  if (event === "PAYMENT_OVERDUE" || status === "OVERDUE") {
    return "FAILED" as const;
  }

  return "PENDING" as const;
}

function cleanToken(value?: string | null) {
  return value?.replace(/^Bearer\s+/i, "").trim();
}

function isValidAsaasWebhook(request: Request, body: AsaasWebhookPayload | null, url: URL) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return true;
  }

  const candidates = [
    request.headers.get("asaas-access-token"),
    request.headers.get("access_token"),
    request.headers.get("x-asaas-token"),
    request.headers.get("x-webhook-token"),
    request.headers.get("authorization"),
    url.searchParams.get("token"),
    body?.token,
    body?.accessToken
  ]
    .map(cleanToken)
    .filter(Boolean);

  return candidates.some((receivedToken) => receivedToken === expectedToken);
}

function webhookResponse(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers
    }
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as AsaasWebhookPayload | null;

  if (!isValidAsaasWebhook(request, body, url)) {
    return webhookResponse({ error: "Token invalido." }, { status: 401 });
  }

  const paymentId = body?.payment?.id;
  const orderCode = body?.payment?.externalReference;

  if (!paymentId) {
    return webhookResponse({ error: "Payload invalido." }, { status: 400 });
  }

  if (!orderCode) {
    await syncAsaasPaymentByExternalId(paymentId);
    return webhookResponse({ received: true });
  }

  await handlePaymentWebhook({
    externalId: paymentId,
    orderCode,
    status: mapAsaasStatus(body?.event, body?.payment?.status),
    reason: body?.event,
    rawPayload: body
  });

  return webhookResponse({ received: true });
}
