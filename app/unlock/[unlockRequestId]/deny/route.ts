import { NextRequest, NextResponse } from "next/server";
import { resolveUnlockRequestByPartner } from "@/features/protection-unlock/unlock-request.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { unlockRequestId } = (await context.params) as { unlockRequestId: string };
  const formData = await request.formData();
  const note = String(formData.get("note") ?? "").trim();
  const redirectUrl = new URL(`/unlock/${unlockRequestId}`, request.url);

  try {
    await resolveUnlockRequestByPartner({
      unlockRequestId,
      note: note || undefined
    });
    redirectUrl.searchParams.set("denied", "1");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      getFriendlyErrorMessage(error, "Não foi possível negar a solicitação.")
    );
    return NextResponse.redirect(redirectUrl);
  }
}
