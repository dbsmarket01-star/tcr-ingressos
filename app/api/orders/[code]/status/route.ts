import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { code } = await params;

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
