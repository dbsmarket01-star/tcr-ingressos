import { NextResponse } from "next/server";
import { unlockApprovalSchema } from "@/features/mobile-auth/mobile-auth.schema";
import { verifyUnlockApproval } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = unlockApprovalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await verifyUnlockApproval(parsed.data);

    return NextResponse.json(
      {
        unlockRequest: {
          id: result.id,
          status: result.status,
          approvedAt: result.approvedAt
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
        error: error instanceof Error ? error.message : "Nao foi possivel aprovar a solicitacao."
      },
      { status: 400 }
    );
  }
}
