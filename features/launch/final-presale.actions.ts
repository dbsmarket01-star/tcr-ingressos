"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/features/audit/audit.service";
import { requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function updateManualPresaleCheckAction(formData: FormData) {
  const admin = await requirePermission("PRODUCTION");
  const eventId = cleanText(formData.get("eventId"));
  const key = cleanText(formData.get("key"));
  const note = cleanText(formData.get("note"));
  const checked = formData.get("checked") === "on";

  if (!eventId || !key) {
    redirect("/admin/final-presale");
  }

  await requireEventAccess(eventId);

  const item = await prisma.eventPresaleCheck.findUnique({
    where: {
      eventId_key: {
        eventId,
        key
      }
    }
  });

  if (!item) {
    redirect(`/admin/final-presale?eventId=${eventId}#manual`);
  }

  await prisma.eventPresaleCheck.update({
    where: {
      eventId_key: {
        eventId,
        key
      }
    },
    data: {
      checked,
      note: note || null,
      checkedAt: checked ? new Date() : null
    }
  });

  await createAuditLog({
    adminUserId: admin.id,
    action: checked ? "PRESALE_CHECK_MARKED" : "PRESALE_CHECK_UNMARKED",
    entityType: "EventPresaleCheck",
    entityId: item.id,
    metadata: {
      eventId,
      key,
      note: note || null
    }
  });

  revalidatePath("/admin/final-presale");
  revalidatePath("/admin/audit");
  redirect(`/admin/final-presale?eventId=${eventId}#manual`);
}
