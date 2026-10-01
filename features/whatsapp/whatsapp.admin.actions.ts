"use server";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/auth.service";
/** Legacy forms must not bypass the durable queue or consent checks. */
export async function sendLeadWhatsAppBroadcast(_formData: FormData) {
  await requirePermission("MARKETING");
  redirect("/admin/marketing/whatsapp");
}
