import { z } from "zod";
import { NextResponse } from "next/server";
import { getAppUserFromBearerToken, logoutMobileSession } from "@/features/mobile-auth/mobile-auth.service";
import { completeUnlockRequest, getUnlockAvailability } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

const logoutSchema = z.object({
  deviceId: z.string().trim().optional()
});

export async function POST(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = logoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    const unlock = await getUnlockAvailability({
      userId: auth.user.id,
      actionType: "LOGOUT_DEVICE",
      deviceId: parsed.data.deviceId
    });

    if (!unlock.canProceed || !unlock.request) {
      return NextResponse.json({ error: "Logout protegido exige aprovação supervisionada." }, { status: 403 });
    }

    await logoutMobileSession({
      userId: auth.user.id,
      sessionId: auth.session.id
    });

    await completeUnlockRequest({
      userId: auth.user.id,
      unlockRequestId: unlock.request.id
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel encerrar a sessao." },
      { status: 400 }
    );
  }
}
