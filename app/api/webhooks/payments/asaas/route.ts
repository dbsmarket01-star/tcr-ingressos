import { NextResponse } from "next/server";
import {
  findAsaasWebhookOrganization,
  handlePaymentWebhook,
  syncAsaasPaymentByExternalId
} from "@/features/payments/payment.service";
import { getAsaasWebhookTokenForOrganization } from "@/features/payments/payment-organization-config";
import type { PaymentOrganizationContext } from "@/features/payments/payment-organization-config";
import { prisma } from "@/lib/prisma";

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

function isAsaasRefundOrChargeback(event?: string, status?: string) {
  const normalizedEvent = event?.trim().toUpperCase();
  const normalizedStatus = status?.trim().toUpperCase();
  const values = [normalizedEvent, normalizedStatus].filter(Boolean);

  return values.some((value) =>
    value === "REFUNDED" ||
    value === "PAYMENT_REFUNDED" ||
    value === "PAYMENT_REFUND_IN_PROGRESS" ||
    value === "PAYMENT_RECEIVED_IN_CASH_UNDONE" ||
    value === "PAYMENT_CHARGEBACK_REQUESTED" ||
    value === "PAYMENT_CHARGEBACK_DISPUTE" ||
    value === "CHARGEBACK_REQUESTED" ||
    value === "CHARGEBACK_DISPUTE" ||
    value === "CHARGEBACK"
  );
}

function mapAsaasStatus(event?: string, status?: string) {
  const normalizedEvent = event?.trim().toUpperCase();
  const normalizedStatus = status?.trim().toUpperCase();

  if (isAsaasRefundOrChargeback(event, status)) {
    return "REFUNDED" as const;
  }

  if (
    normalizedEvent === "PAYMENT_CONFIRMED" ||
    normalizedEvent === "PAYMENT_RECEIVED" ||
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "RECEIVED"
  ) {
    return "APPROVED" as const;
  }

  if (
    normalizedEvent === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED" ||
    normalizedEvent === "PAYMENT_REPROVED_BY_RISK_ANALYSIS" ||
    normalizedEvent === "PAYMENT_OVERDUE" ||
    normalizedStatus === "OVERDUE" ||
    normalizedStatus === "REPROVED" ||
    normalizedStatus === "REFUSED"
  ) {
    return "FAILED" as const;
  }

  if (
    normalizedEvent === "PAYMENT_DELETED" ||
    normalizedEvent === "PAYMENT_BANK_SLIP_CANCELLED" ||
    normalizedStatus === "DELETED" ||
    normalizedStatus === "CANCELED" ||
    normalizedStatus === "CANCELLED"
  ) {
    return "CANCELED" as const;
  }

  return "PENDING" as const;
}

function cleanToken(value?: string | null) {
  return value?.replace(/^Bearer\s+/i, "").trim();
}

async function getConfiguredAsaasWebhookTokens() {
  const tokens = new Set<string>();
  const globalToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();

  if (globalToken) {
    tokens.add(globalToken);
  }

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      slug: true,
      name: true
    }
  });

  for (const organization of organizations) {
    const token = getAsaasWebhookTokenForOrganization(organization).value?.trim();

    if (token) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

async function isValidAsaasWebhook(
  request: Request,
  body: AsaasWebhookPayload | null,
  url: URL,
  organization?: PaymentOrganizationContext | null
) {
  const scopedToken = getAsaasWebhookTokenForOrganization(organization).value;
  const expectedTokens = scopedToken ? [scopedToken] : await getConfiguredAsaasWebhookTokens();

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

    if (!(await isValidAsaasWebhook(request, body, url, organization))) {
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
