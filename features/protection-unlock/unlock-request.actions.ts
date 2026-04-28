"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import { resolveUnlockRequestByAdmin } from "@/features/protection-unlock/unlock-request.service";

export async function resolveUnlockRequestAction(formData: FormData) {
  const admin = await requirePermission("INCIDENTS");
  const unlockRequestId = String(formData.get("unlockRequestId") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "").trim() as "DENIED" | "CANCELED";
  const note = String(formData.get("note") ?? "").trim();
  const params = new URLSearchParams();

  try {
    if (!unlockRequestId) {
      throw new Error("Solicitação inválida.");
    }

    if (!["DENIED", "CANCELED"].includes(resolution)) {
      throw new Error("Resolução inválida.");
    }

    const result = await resolveUnlockRequestByAdmin({
      unlockRequestId,
      resolution,
      note: note || undefined,
      adminUserId: admin.id
    });

    await createAuditLog({
      adminUserId: admin.id,
      action: resolution === "DENIED" ? "UNLOCK_REQUEST_DENIED" : "UNLOCK_REQUEST_CANCELED",
      entityType: "UnlockRequest",
      entityId: result.id,
      metadata: {
        actionType: result.actionType,
        userId: result.userId,
        deviceId: result.deviceId,
        note: note || null
      }
    });

    params.set("resolved", resolution.toLowerCase());
  } catch (error) {
    params.set("error", error instanceof Error ? error.message : "Não foi possível atualizar a solicitação.");
  }

  revalidatePath("/admin/unlocks");
  revalidatePath("/admin/incidents");
  revalidatePath("/admin/devices");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/security");
  revalidatePath("/admin");

  redirect(`/admin/unlocks?${params.toString()}`);
}
