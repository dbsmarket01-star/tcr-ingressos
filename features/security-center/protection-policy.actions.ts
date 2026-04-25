"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { requirePermission } from "@/features/auth/auth.service";
import { protectionPolicySchema } from "./protection-policy.schema";
import { updateDefaultProtectionPolicy } from "./protection-policy.service";

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on";
}

export async function updateProtectionPolicyAction(formData: FormData) {
  const admin = await requirePermission("SETTINGS");

  const parsed = protectionPolicySchema.safeParse({
    name: String(formData.get("policyName") ?? ""),
    description: String(formData.get("policyDescription") ?? "") || undefined,
    targetPornographyOnly: asBoolean(formData.get("targetPornographyOnly")),
    enforceAndroidVpn: asBoolean(formData.get("enforceAndroidVpn")),
    enforceIosDnsProxy: asBoolean(formData.get("enforceIosDnsProxy")),
    blockUnknownDnsChanges: asBoolean(formData.get("blockUnknownDnsChanges")),
    detectExternalVpn: asBoolean(formData.get("detectExternalVpn")),
    detectProxy: asBoolean(formData.get("detectProxy")),
    detectDeveloperMode: asBoolean(formData.get("detectDeveloperMode")),
    pinRequiredToDisable: asBoolean(formData.get("pinRequiredToDisable")),
    heartbeatIntervalMinutes: String(formData.get("heartbeatIntervalMinutes") ?? "15"),
    staleHeartbeatGraceMinutes: String(formData.get("staleHeartbeatGraceMinutes") ?? "45")
  });

  if (!parsed.success) {
    redirect("/admin/settings?error=Verifique%20as%20configuracoes%20da%20politica%20de%20protecao.");
  }

  const policy = await updateDefaultProtectionPolicy(parsed.data);

  await createAuditLog({
    adminUserId: admin.id,
    action: "PROTECTION_POLICY_UPDATED",
    entityType: "ProtectionPolicy",
    entityId: policy.id,
    metadata: {
      version: policy.version,
      enforceAndroidVpn: policy.enforceAndroidVpn,
      detectExternalVpn: policy.detectExternalVpn
    }
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/security");
  revalidatePath("/admin/audit");
  redirect("/admin/settings?policySaved=1");
}
