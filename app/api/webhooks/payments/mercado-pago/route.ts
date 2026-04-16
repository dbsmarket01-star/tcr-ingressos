import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { handlePaymentWebhook } from "@/features/payments/payment.service";
import { getMercadoPagoProvider } from "@/features/payments/payment-provider";

function mapMercadoPagoStatus(status?: string) {
  if (status === "approved") {
    return "APPROVED" as const;
  }

  if (status === "rejected" || status === "cancelled" || status === "refunded" || status === "charged_back") {
    return "FAILED" as const;
  }

  return "PENDING" as const;
}

function extractPaymentId(body: unknown, url: URL) {
  if (typeof body === "object" && body !== null) {
    const payload = body as {
      data?: { id?: string | number };
      id?: string | number;
      resource?: string;
    };

    if (payload.data?.id) {
      return String(payload.data.id);
    }

    if (payload.id) {
      return String(payload.id);
    }

    if (payload.resource) {
      const parts = payload.resource.split("/");
      return parts[parts.length - 1];
    }
  }

  return url.searchParams.get("data.id") || url.searchParams.get("id");
}

function parseSignature(signature: string) {
  return signature.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");

      if (key?.trim() === "ts") {
        acc.ts = value?.trim();
      }

      if (key?.trim() === "v1") {
        acc.v1 = value?.trim();
      }

      return acc;
    },
    {} as { ts?: string; v1?: string }
  );
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidMercadoPagoSignature(request: Request, paymentId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    return false;
  }

  const { ts, v1 } = parseSignature(xSignature);

  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  return safeCompare(expected, v1);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as unknown;
  const paymentId = extractPaymentId(body, url);

  if (!paymentId) {
    return NextResponse.json({ error: "Pagamento nao informado." }, { status: 400 });
  }

  if (!isValidMercadoPagoSignature(request, paymentId)) {
    return NextResponse.json({ error: "Assinatura invalida." }, { status: 401 });
  }

  const mercadoPago = getMercadoPagoProvider();
  const payment = await mercadoPago.getPayment(paymentId);
  const orderCode = payment.external_reference;

  if (!orderCode) {
    return NextResponse.json({ error: "Referencia do pedido nao informada." }, { status: 400 });
  }

  await handlePaymentWebhook({
    externalId: String(payment.id || paymentId),
    orderCode,
    status: mapMercadoPagoStatus(payment.status),
    reason: payment.status_detail,
    rawPayload: payment
  });

  return NextResponse.json({ received: true });
}
