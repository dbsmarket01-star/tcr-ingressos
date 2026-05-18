import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeUninstallPreparation, getAppUserFromBearerToken } from "@/features/mobile-auth/mobile-auth.service";
import { completeUnlockRequest, getUnlockAvailability } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

const uninstallSchema = z.object({
  deviceId: z.string().trim().optional()
});

export async function POST(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = uninstallSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    const unlock = await getUnlockAvailability({
      userId: auth.user.id,
      actionType: "REQUEST_UNINSTALL",
      deviceId: parsed.data.deviceId
    });

    if (!unlock.canProceed || !unlock.request) {
      return NextResponse.json({ error: "Desinstalação exige aprovação supervisionada." }, { status: 403 });
    }

    const result = await authorizeUninstallPreparation({
      userId: auth.user.id,
      deviceId: parsed.data.deviceId
    });

    await completeUnlockRequest({
      userId: auth.user.id,
      unlockRequestId: unlock.request.id
    });

    return NextResponse.json(
      { ok: true, uninstallReadyAt: result.uninstallReadyAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel preparar a desinstalacao." },
      { status: 400 }
    );
  }
}
