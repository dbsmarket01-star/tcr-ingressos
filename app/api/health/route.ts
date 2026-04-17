import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function hasValue(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        checkedAt: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt,
        app: {
          url: getAppUrl(),
          environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
          hosting: process.env.HOSTING_PROVIDER || (process.env.VERCEL ? "VERCEL" : "LOCAL"),
          region: process.env.VERCEL_REGION || process.env.AWS_REGION || null
        },
        infrastructure: {
          databasePooling: hasValue(process.env.DATABASE_URL) && process.env.DATABASE_URL!.includes("pgbouncer=true"),
          storageProvider: process.env.UPLOAD_STORAGE_PROVIDER || "LOCAL",
          paymentProvider: process.env.PAYMENT_PROVIDER || "SIMULATED",
          emailConfigured: hasValue(process.env.RESEND_API_KEY),
          cronProtected: hasValue(process.env.CRON_SECRET)
        }
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        checkedAt: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
