import { NextResponse } from "next/server";
import { getAppUserFromBearerToken } from "@/features/mobile-auth/mobile-auth.service";
import { getUnlockAvailability } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function GET(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const actionType = url.searchParams.get("actionType");
  const deviceId = url.searchParams.get("deviceId") || undefined;

  if (!actionType) {
    return NextResponse.json({ error: "actionType e obrigatorio." }, { status: 400 });
  }

  try {
    const result = await getUnlockAvailability({
      userId: auth.user.id,
      actionType,
      deviceId
    });

    return NextResponse.json(
      {
        canProceed: result.canProceed,
        coolingDown: result.coolingDown,
        unlockRequest: result.request
          ? {
              id: result.request.id,
              actionType: result.request.actionType,
              status: result.request.status,
              partnerEmail: result.request.partnerEmail,
              expiresAt: result.request.expiresAt,
              approvedAt: result.request.approvedAt,
              cooldownEndsAt: result.request.cooldownEndsAt
            }
          : null
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
        error: error instanceof Error ? error.message : "Nao foi possivel consultar a solicitacao."
      },
      { status: 400 }
    );
  }
}
