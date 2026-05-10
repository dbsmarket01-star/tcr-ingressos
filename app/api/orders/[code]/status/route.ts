import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, getRequestIp } from "@/features/security/rate-limit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { code } = await params;
  const clientIp = getRequestIp(request);

  try {
    assertRateLimit(`order-status:${clientIp}:${code}`, { limit: 40, windowMs: 60_000 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Muitas consultas em pouco tempo."
      },
      { status: 429 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { code },
    select: {
      status: true,
      paidAt: true,
      payment: {
        select: {
          status: true,
          paidAt: true
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: order.status,
      paidAt: order.paidAt,
      paymentStatus: order.payment?.status || null,
      paymentPaidAt: order.payment?.paidAt || null
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
