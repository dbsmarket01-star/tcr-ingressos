import { NextResponse } from "next/server";
import { registerAppUser } from "@/features/mobile-auth/mobile-auth.service";
import { appUserRegistrationSchema } from "@/features/mobile-auth/mobile-auth.schema";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = appUserRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Dados invalidos."
      },
      { status: 400 }
    );
  }

  try {
    const result = await registerAppUser(parsed.data);

    return NextResponse.json(
      {
        token: result.token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          status: result.user.status,
          trialEndsAt: result.user.trialEndsAt
        },
        subscriptionPlan: {
          id: result.plan.id,
          code: result.plan.code,
          name: result.plan.name,
          maxDevices: result.plan.maxDevices
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
        error: error instanceof Error ? error.message : "Nao foi possivel criar a conta."
      },
      { status: 400 }
    );
  }
}
