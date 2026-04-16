import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/features/payments/payment.service";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.externalId || !body.status) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
  }

  await handlePaymentWebhook({
    externalId: String(body.externalId),
    status: body.status,
    reason: body.reason ? String(body.reason) : undefined
  });

  return NextResponse.json({ received: true });
}
