import { NextResponse } from "next/server";
import { loginAppUser } from "@/features/mobile-auth/mobile-auth.service";
import { appUserLoginSchema } from "@/features/mobile-auth/mobile-auth.schema";
import { assertRateLimit, getRequestIp } from "@/features/security/rate-limit";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function POST(request: Request) {
  const clientIp = getRequestIp(request);

  try {
    assertRateLimit(`mobile-login:${clientIp}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Muitas tentativas. Aguarde alguns instantes."
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = appUserLoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await loginAppUser(parsed.data);

    return NextResponse.json(
      {
        token: result.token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          status: result.user.status
        },
        activeSubscription: result.activeSubscription
          ? {
              id: result.activeSubscription.id,
              status: result.activeSubscription.status,
              plan: {
                id: result.activeSubscription.plan.id,
                code: result.activeSubscription.plan.code,
                name: result.activeSubscription.plan.name,
                maxDevices: result.activeSubscription.plan.maxDevices
              }
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
        error: error instanceof Error ? error.message : "Nao foi possivel autenticar."
      },
      { status: 401 }
    );
  }
}
