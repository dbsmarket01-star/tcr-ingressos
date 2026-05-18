import { NextResponse } from "next/server";
import { getAppUserFromBearerToken } from "@/features/mobile-auth/mobile-auth.service";
import { protectedActionAttemptSchema } from "@/features/mobile-auth/mobile-auth.schema";
import { recordProtectedActionAttempt } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function POST(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = protectedActionAttemptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await recordProtectedActionAttempt({
      userId: auth.user.id,
      ...parsed.data
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nao foi possivel registrar a tentativa."
      },
      { status: 400 }
    );
  }
}
