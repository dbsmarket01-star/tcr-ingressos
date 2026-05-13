import { NextResponse } from "next/server";
import { getMaintenanceOrganizationForRequest } from "@/features/maintenance/maintenance-organization";
import { reconcileAsaasPayments } from "@/features/payments/payment.service";

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
    return NextResponse.json(
      { error: "Nao autorizado." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") || "500", 10);
  const lookbackHours = Number.parseInt(url.searchParams.get("lookbackHours") || String(24 * 7), 10);

  try {
    const organization = await getMaintenanceOrganizationForRequest(request);
    const result = await reconcileAsaasPayments({
      limit: Number.isFinite(limit) ? limit : 500,
      lookbackHours: Number.isFinite(lookbackHours) ? lookbackHours : 24 * 7,
      organizationId: organization?.id
    });

    return NextResponse.json(
      {
        ok: true,
        organization: organization
          ? {
              id: organization.id,
              slug: organization.slug,
              name: organization.name
            }
          : null,
        ...result
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("[maintenance:reconcile-asaas-payments]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Nao foi possivel reconciliar pagamentos Asaas."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
