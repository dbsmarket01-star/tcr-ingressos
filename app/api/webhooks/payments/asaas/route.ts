import { NextResponse } from "next/server";
import {
  findAsaasWebhookOrganization,
  handlePaymentWebhook,
  syncAsaasPaymentByExternalId
} from "@/features/payments/payment.service";
import { getAsaasWebhookTokenForOrganization } from "@/features/payments/payment-organization-config";
import type { PaymentOrganizationContext } from "@/features/payments/payment-organization-config";

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
    return "REFUNDED" as const;
  }

  if (event === "PAYMENT_OVERDUE" || status === "OVERDUE") {
    return "FAILED" as const;
  }

  return "PENDING" as const;
}

function cleanToken(value?: string | null) {
  return value?.replace(/^Bearer\s+/i, "").trim();
}

function getConfiguredAsaasWebhookTokens() {
  return Object.entries(process.env)
    .filter(([key]) => key === "ASAAS_WEBHOOK_TOKEN" || key.startsWith("ASAAS_WEBHOOK_TOKEN_"))
    .map(([, value]) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function isValidAsaasWebhook(
  request: Request,
  body: AsaasWebhookPayload | null,
  url: URL,
  organization?: PaymentOrganizationContext | null
) {
  const scopedToken = getAsaasWebhookTokenForOrganization(organization).value;
  const expectedTokens = scopedToken ? [scopedToken] : getConfiguredAsaasWebhookTokens();

  if (expectedTokens.length === 0) {
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
    .filter((token): token is string => Boolean(token));

  return candidates.some((receivedToken) => expectedTokens.includes(receivedToken));
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

  const paymentId = body?.payment?.id;
  const orderCode = body?.payment?.externalReference;

  if (!paymentId) {
    return webhookResponse({ error: "Payload invalido." }, { status: 400 });
  }

  try {
    const organization = await findAsaasWebhookOrganization({
      orderCode,
      externalId: paymentId
    });

    if (!isValidAsaasWebhook(request, body, url, organization)) {
      return webhookResponse({ error: "Token invalido." }, { status: 401 });
    }

    if (!orderCode) {
      const syncResult = await syncAsaasPaymentByExternalId(paymentId);

      return webhookResponse({
        received: true,
        ignored: !syncResult.handled
      });
    }

    await handlePaymentWebhook({
      externalId: paymentId,
      orderCode,
      status: mapAsaasStatus(body?.event, body?.payment?.status),
      reason: body?.event,
      rawPayload: body
    });

    return webhookResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Pagamento nao encontrado para o webhook")) {
      console.warn("[asaas-webhook] Evento ignorado por nao existir no sistema.", {
        paymentId,
        orderCode,
        event: body?.event,
        status: body?.payment?.status
      });

      return webhookResponse({ received: true, ignored: true });
    }

    console.error("[asaas-webhook] Falha ao processar webhook.", {
      paymentId,
      orderCode,
      event: body?.event,
      status: body?.payment?.status,
      error: message
    });

    return webhookResponse({ error: "Falha ao processar webhook." }, { status: 500 });
  }
}
