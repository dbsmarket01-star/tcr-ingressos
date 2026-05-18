import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUserFromBearerToken } from "@/features/mobile-auth/mobile-auth.service";
import { completeUnlockRequest } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

const completeUnlockSchema = z.object({
  unlockRequestId: z.string().trim().min(8)
});

export async function POST(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = completeUnlockSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await completeUnlockRequest({
      userId: auth.user.id,
      unlockRequestId: parsed.data.unlockRequestId
    });

    return NextResponse.json(
      {
        unlockRequest: {
          id: result.id,
          status: result.status,
          completedAt: result.completedAt
        }
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
        error: error instanceof Error ? error.message : "Nao foi possivel concluir a solicitacao."
      },
      { status: 400 }
    );
  }
}
