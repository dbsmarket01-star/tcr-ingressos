import { NextResponse } from "next/server";
import { getMaintenanceOrganizationForRequest } from "@/features/maintenance/maintenance-organization";
import { sendCartAbandonmentReminders } from "@/features/orders/order.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization")?.trim();
  return authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Nao autorizado."
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    const organization = await getMaintenanceOrganizationForRequest(request);
    const result = await sendCartAbandonmentReminders({
      limit: 500,
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
    console.error("[cron:cart-abandonment]", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Nao foi possivel enviar lembretes de carrinho abandonado."
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
