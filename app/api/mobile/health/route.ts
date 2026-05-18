import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function GET() {
  try {
    const availablePlans = await prisma.subscriptionPlan.count({
      where: {
        status: "ACTIVE"
      }
    });

    return NextResponse.json(
      {
        ready: availablePlans > 0,
        availablePlans,
        serverTime: new Date().toISOString(),
        message:
          availablePlans > 0
            ? "Backend mobile pronto para autenticacao."
            : "Backend online, mas sem planos ativos."
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ready: false,
        availablePlans: 0,
        serverTime: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Falha no health check mobile."
      },
      { status: 500 }
    );
  }
}
