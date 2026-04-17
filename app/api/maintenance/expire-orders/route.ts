import { NextResponse } from "next/server";
import { expirePendingOrders } from "@/features/orders/order.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const url = new URL(request.url);
  const authorization = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const token = request.headers.get("x-cron-token") || url.searchParams.get("token");

  return authorization === secret || token === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const result = await expirePendingOrders({ limit: 500 });

  return NextResponse.json({
    ok: true,
    ...result
  });
}

export async function POST(request: Request) {
  return GET(request);
}
