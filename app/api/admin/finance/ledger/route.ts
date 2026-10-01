import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentAdmin,
  canAccessArea,
  getAdminAllowedEventIds,
} from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { entrySchema, centsSchema } from "@/features/finance/ledger/rules";
import { correctLedgerEntry } from "@/features/finance/ledger/store";
import {
  configureLedger,
  openingSchema,
  reconcileDailyLedger,
  publishClosing,
  allocateWithdrawal,
  resolveFinancialIncident,
} from "@/features/finance/ledger/closing.service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const bodySchema = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("configure"), opening: openingSchema })
    .strict(),
  z.object({ operation: z.literal("reconcile"), date: z.iso.date() }).strict(),
  z
    .object({ operation: z.literal("publish"), closingId: z.string().min(1) })
    .strict(),
  z
    .object({
      operation: z.literal("correct"),
      entryId: z.string().min(1),
      reason: z.string().min(10),
      replacement: entrySchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("allocate-withdrawal"),
      transactionId: z.string().min(1),
      producerInCents: centsSchema,
      evidence: z.string().min(10),
    })
    .strict(),
  z
    .object({
      operation: z.literal("resolve-incident"),
      incidentId: z.string().min(1),
      evidence: z.string().min(10),
    })
    .strict(),
]);
const response = (data: unknown, status = 200) =>
  new NextResponse(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
async function authorize() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;
  if (
    !canAccessArea(admin.role, "FINANCE") ||
    getAdminAllowedEventIds(admin) !== null
  )
    return null;
  const org = await prisma.organization.findFirst({
    where: { id: admin.organizationId, slug: "tcr-ingressos", isActive: true },
    select: { id: true },
  });
  return org ? admin : null;
}
export async function GET() {
  const admin = await authorize();
  if (!admin) return response({ error: "FORBIDDEN" }, 403);
  const [closings, incidents] = await Promise.all([
    prisma.financialClosing.findMany({
      where: { organizationId: admin.organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.financialIncident.findMany({
      where: { organizationId: admin.organizationId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return response({ closings, incidents });
}
export async function POST(request: Request) {
  // Session-authenticated mutations must be same-origin; the cron has its own bearer-auth route.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return response({ error: "INVALID_ORIGIN" }, 403);
  const admin = await authorize();
  if (!admin) return response({ error: "FORBIDDEN" }, 403);
  try {
    const input = bodySchema.parse(await request.json());
    if (input.operation !== "reconcile" && admin.role !== "OWNER")
      return response({ error: "OWNER_REQUIRED" }, 403);
    let result: unknown;
    switch (input.operation) {
      case "configure":
        result = await configureLedger(
          admin.organizationId,
          admin.id,
          input.opening,
        );
        break;
      case "reconcile":
        result = await reconcileDailyLedger(
          admin.organizationId,
          admin.id,
          input.date,
        );
        break;
      case "publish":
        result = await publishClosing(
          admin.organizationId,
          admin.id,
          input.closingId,
        );
        break;
      case "correct":
        result = await correctLedgerEntry(
          admin.organizationId,
          admin.id,
          input,
        );
        break;
      case "allocate-withdrawal":
        result = await allocateWithdrawal(
          admin.organizationId,
          admin.id,
          input.transactionId,
          input.producerInCents,
          input.evidence,
        );
        break;
      case "resolve-incident":
        result = await resolveFinancialIncident(
          admin.organizationId,
          admin.id,
          input.incidentId,
          input.evidence,
        );
        break;
    }
    return response({ result });
  } catch (error) {
    if (error instanceof z.ZodError)
      return response({ error: "INVALID_INPUT", issues: error.issues }, 400);
    const message = error instanceof Error ? error.message : "";
    return response(
      {
        error: /^[A-Z_]+$/.test(message)
          ? message
          : "FINANCIAL_OPERATION_FAILED",
      },
      409,
    );
  }
}
