import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type ResendEmailWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    failed?: {
      reason?: string;
    };
    bounce?: {
      message?: string;
      type?: string;
      subType?: string;
    };
    suppressed?: {
      message?: string;
      type?: string;
    };
  };
  token?: string;
};

function cleanToken(value?: string | null) {
  return value?.replace(/^Bearer\s+/i, "").trim();
}

function isValidResendWebhook(request: Request, body: ResendEmailWebhookPayload | null, url: URL) {
  const expectedToken = process.env.RESEND_WEBHOOK_TOKEN?.trim();

  if (!expectedToken) {
    return true;
  }

  const candidates = [
    request.headers.get("authorization"),
    request.headers.get("x-webhook-token"),
    request.headers.get("x-resend-token"),
    url.searchParams.get("token"),
    body?.token
  ]
    .map(cleanToken)
    .filter(Boolean);

  return candidates.some((receivedToken) => receivedToken === expectedToken);
}

function mapResendEmailStatus(type?: string) {
  switch (type) {
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "delivery_delayed";
    case "email.failed":
      return "failed";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.suppressed":
      return "suppressed";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.sent":
      return "sent";
    case "email.scheduled":
      return "scheduled";
    default:
      return type?.replace(/^email\./, "") || "unknown";
  }
}

function getResendFailureReason(body: ResendEmailWebhookPayload) {
  return (
    body.data?.failed?.reason ||
    body.data?.bounce?.message ||
    body.data?.suppressed?.message ||
    body.data?.bounce?.type ||
    body.data?.suppressed?.type ||
    null
  );
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
  const body = (await request.json().catch(() => null)) as ResendEmailWebhookPayload | null;

  if (!isValidResendWebhook(request, body, url)) {
    return webhookResponse({ error: "Token invalido." }, { status: 401 });
  }

  const providerId = body?.data?.email_id;

  if (!providerId) {
    return webhookResponse({ error: "Payload invalido." }, { status: 400 });
  }

  const status = mapResendEmailStatus(body?.type);
  const checkedAt = body?.created_at ? new Date(body.created_at) : new Date();
  const failureReason = getResendFailureReason(body);

  const updateResult = await prisma.order.updateMany({
    where: {
      ticketsEmailProviderId: providerId
    },
    data: {
      ticketsEmailStatus: status,
      ticketsEmailLastCheckedAt: checkedAt,
      ticketsEmailLastError: failureReason,
      ...(status === "delivered" ? { ticketsEmailDeliveredAt: checkedAt } : {})
    }
  });

  return webhookResponse({
    received: true,
    matched: updateResult.count,
    status
  });
}
