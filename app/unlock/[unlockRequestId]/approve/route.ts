import { NextRequest, NextResponse } from "next/server";
import { verifyUnlockApproval } from "@/features/protection-unlock/unlock-request.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<unknown> }
) {
  const { unlockRequestId } = (await context.params) as { unlockRequestId: string };
  const formData = await request.formData();
  const approvalCode = String(formData.get("approvalCode") ?? "").trim();
  const redirectUrl = new URL(`/unlock/${unlockRequestId}`, request.url);

  if (!approvalCode) {
    redirectUrl.searchParams.set("error", "Informe o código de aprovação.");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await verifyUnlockApproval({
      unlockRequestId,
      approvalCode
    });
    redirectUrl.searchParams.set("success", "1");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      getFriendlyErrorMessage(error, "Não foi possível aprovar a solicitação.")
    );
    return NextResponse.redirect(redirectUrl);
  }
}
