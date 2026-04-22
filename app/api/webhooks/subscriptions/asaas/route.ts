import { NextResponse } from "next/server";
import { handleAsaasSubscriptionWebhook } from "@/features/subscriptions/asaas-subscription.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

function webhookResponse(payload: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers
    }
  });
}

function cleanToken(value?: string | null) {
  return value?.replace(/^Bearer\s+/i, "").trim();
}

function isValidWebhook(request: Request, body: Record<string, unknown> | null, url: URL) {
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
    typeof body?.token === "string" ? body.token : null,
    typeof body?.accessToken === "string" ? body.accessToken : null
  ]
    .map(cleanToken)
    .filter(Boolean);

  return candidates.some((token) => token === expectedToken);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!isValidWebhook(request, body, url)) {
    return webhookResponse({ error: "Token invalido." }, { status: 401 });
  }

  try {
    const result = await handleAsaasSubscriptionWebhook(body as never);

    return webhookResponse({
      received: true,
      ignored: !result.handled
    });
  } catch (error) {
    console.error("[asaas-subscription-webhook] Falha ao processar webhook.", {
      event: typeof body?.event === "string" ? body.event : null,
      subscriptionId:
        body && typeof body === "object" && "subscription" in body && body.subscription && typeof body.subscription === "object"
          ? (body.subscription as { id?: string }).id || null
          : null,
      paymentId:
        body && typeof body === "object" && "payment" in body && body.payment && typeof body.payment === "object"
          ? (body.payment as { id?: string }).id || null
          : null,
      error: error instanceof Error ? error.message : error
    });

    return webhookResponse({ error: "Falha ao processar webhook." }, { status: 500 });
  }
}
