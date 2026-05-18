import { NextResponse } from "next/server";
import { getAppUserFromBearerToken, registerProtectedDevice } from "@/features/mobile-auth/mobile-auth.service";
import { deviceRegistrationSchema } from "@/features/mobile-auth/mobile-auth.schema";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function POST(request: Request) {
  const auth = await getAppUserFromBearerToken(request.headers.get("authorization"));

  if (!auth) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deviceRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await registerProtectedDevice({
      userId: auth.user.id,
      ...parsed.data
    });

    return NextResponse.json(
      {
        device: {
          id: result.device.id,
          installationKey: result.device.installationKey,
          status: result.device.status,
          protectionStatus: result.device.protectionStatus,
          platform: result.device.platform,
          protectionMode: result.device.protectionMode
        },
        policy: result.policy
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
        error: error instanceof Error ? error.message : "Nao foi possivel registrar o dispositivo."
      },
      { status: 400 }
    );
  }
}
