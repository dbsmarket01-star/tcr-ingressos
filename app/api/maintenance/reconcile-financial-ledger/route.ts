import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reconcileDailyLedger } from "@/features/finance/ledger/closing.service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
function previousSaoPauloDate() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1))
    .toISOString()
    .slice(0, 10);
}

async function reconcile(request: Request, date: string) {
  const secret = process.env.CRON_SECRET,
    supplied = request.headers
      .get("authorization")
      ?.match(/^Bearer (.+)$/)?.[1];
  if (
    !secret ||
    !supplied ||
    Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))
  )
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    z.iso.date().parse(date);
    const org = await prisma.organization.findFirstOrThrow({
      where: { slug: "tcr-ingressos", isActive: true },
      select: { id: true },
    });
    const result = await reconcileDailyLedger(
      org.id,
      "cron:financial-reconciliation",
      date,
    );
    return new NextResponse(
      JSON.stringify(result, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "RECONCILIATION_FAILED" },
      { status: 409 },
    );
  }
}

/** Vercel Cron invokes this route with GET and Authorization: Bearer CRON_SECRET. */
export async function GET(request: Request) {
  return reconcile(request, previousSaoPauloDate());
}

/** Kept for an explicitly dated, authenticated maintenance run. */
export async function POST(request: Request) {
  const { date } = z
    .object({ date: z.iso.date() })
    .strict()
    .parse(await request.json());
  return reconcile(request, date);
}
