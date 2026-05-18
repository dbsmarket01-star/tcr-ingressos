import { NextResponse } from "next/server";
import { getAppUserFromBearerToken, getMobileBootstrap } from "@/features/mobile-auth/mobile-auth.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function GET(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const payload = await getMobileBootstrap(auth.user.id);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nao foi possivel carregar o bootstrap."
      },
      { status: 400 }
    );
  }
}
