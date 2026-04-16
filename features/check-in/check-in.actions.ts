"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateTicketForCheckIn } from "./check-in.service";

export async function validateTicketAction(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const deviceName = String(formData.get("deviceName") ?? "").trim();
  const result = await validateTicketForCheckIn(code, deviceName || undefined);

  revalidatePath("/admin/check-in");

  const params = new URLSearchParams({
    status: result.status,
    message: result.message
  });

  if (result.ticket) {
    params.set("ticket", result.ticket.code);
    params.set("event", result.ticket.eventTitle);
    params.set("lot", result.ticket.lotName);
    params.set("buyer", result.ticket.buyerName);
    if (result.ticket.checkedAt) {
      params.set("checkedAt", result.ticket.checkedAt.toISOString());
    }
  }

  redirect(`/admin/check-in?${params.toString()}`);
}
