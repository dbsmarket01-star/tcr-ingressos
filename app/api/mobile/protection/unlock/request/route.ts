import { NextResponse } from "next/server";
import { getAppUserFromBearerToken } from "@/features/mobile-auth/mobile-auth.service";
import { unlockRequestSchema } from "@/features/mobile-auth/mobile-auth.schema";
import { createUnlockRequest } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function POST(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = unlockRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await createUnlockRequest({
      userId: auth.user.id,
      requestedByEmail: auth.user.email,
      ...parsed.data
    });

    return NextResponse.json(
      {
        unlockRequest: {
          id: result.unlockRequest.id,
          actionType: result.unlockRequest.actionType,
          status: result.unlockRequest.status,
          partnerEmail: result.unlockRequest.partnerEmail,
          expiresAt: result.unlockRequest.expiresAt
        },
        reusedExisting: result.reusedExisting
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
        error: error instanceof Error ? error.message : "Nao foi possivel criar a solicitacao."
      },
      { status: 400 }
    );
  }
}
