"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/auth/auth.service";
import { validateTicketForCheckIn } from "./check-in.service";

export async function validateTicketAction(formData: FormData) {
  const admin = await requirePermission("CHECKIN");
  const code = String(formData.get("code") ?? "").trim();
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  const selectedEventId = String(formData.get("eventId") ?? "").trim();

  if (!selectedEventId) {
    redirect("/admin/check-in?status=INVALID&message=Selecione+um+evento+antes+de+validar+o+ingresso.");
  }

  const codeSuffix = code.slice(-6);
  console.info("[check-in] validation requested", {
    eventId: selectedEventId,
    adminUserId: admin.id,
    deviceName: deviceName || null,
    codeSuffix
  });

  let result;

  try {
    result = await validateTicketForCheckIn(code, deviceName || undefined, admin, selectedEventId);
  } catch (error) {
    console.error("[check-in] validation failed", {
      eventId: selectedEventId,
      adminUserId: admin.id,
      deviceName: deviceName || null,
      codeSuffix,
      error: error instanceof Error ? error.message : String(error)
    });
    redirect(`/admin/check-in?${new URLSearchParams({
      eventId: selectedEventId,
      status: "ERROR",
      message: "Não foi possível concluir a validação. Não libere a entrada ainda; confira a conexão e tente novamente. Se aparecer 'já usado', confira o horário do primeiro registro."
    }).toString()}`);
  }

  console.info("[check-in] validation completed", {
    eventId: selectedEventId,
    adminUserId: admin.id,
    deviceName: deviceName || null,
    codeSuffix,
    status: result.status
  });

  revalidatePath("/admin/check-in");

  const params = new URLSearchParams({
    status: result.status,
    message: result.message
  });
  params.set("eventId", selectedEventId);

  if (result.ticket) {
    params.set("ticket", result.ticket.code);
    params.set("event", result.ticket.eventTitle);
    params.set("lot", result.ticket.lotName);
    params.set("buyer", result.ticket.buyerName);
    params.set("ticketUrl", result.ticket.publicUrl);
    if (result.ticket.checkedAt) {
      params.set("checkedAt", result.ticket.checkedAt.toISOString());
    }
  }

  redirect(`/admin/check-in?${params.toString()}`);
}

/** Returns a result without navigation so the camera stream can stay open. */
export async function validateTicketContinuouslyAction(formData: FormData): Promise<import("./continuous-scan").LiveCheckInResult> {
  const admin = await requirePermission("CHECKIN");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const device = String(formData.get("deviceName") ?? "").trim();
  if (!eventId || !code) return { status: "INVALID", message: "Selecione o evento e informe o código. Não libere a entrada." };
  try {
    const result = await validateTicketForCheckIn(code, device || undefined, admin, eventId);
    revalidatePath("/admin/check-in");
    return {
      status: result.status,
      message: result.message,
      ...(result.ticket ? { ticket: {
        code: result.ticket.code, buyerName: result.ticket.buyerName, lotName: result.ticket.lotName,
        checkedAt: result.ticket.checkedAt?.toISOString()
      } } : {})
    };
  } catch (error) {
    console.error("[check-in] continuous validation failed", { eventId, adminUserId: admin.id, error: error instanceof Error ? error.message : "unknown" });
    return { status: "ERROR", message: "Não foi possível confirmar a validação. Não libere a entrada; confira a conexão e consulte o pedido antes de tentar novamente." };
  }
}
