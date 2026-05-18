import { NextResponse } from "next/server";
import { getAppUserFromBearerToken } from "@/features/mobile-auth/mobile-auth.service";
import { getPolicySyncPayload } from "@/features/security-center/protection-policy.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function GET(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const payload = await getPolicySyncPayload(auth.user.id);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nao foi possivel sincronizar a politica."
      },
      { status: 400 }
    );
  }
}
