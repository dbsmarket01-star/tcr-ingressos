"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eventLeadSchema } from "./lead.schema";
import { createOrUpdateEventLead } from "./lead.service";

function validationMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = error.issues as Array<{ path?: Array<string | number> }>;
    const field = issues[0]?.path?.[0];

    const fieldLabels: Record<string, string> = {
      name: "nome",
      email: "e-mail",
      phone: "telefone"
    };

    if (typeof field === "string") {
      return `Verifique o campo ${fieldLabels[field] || field}.`;
    }
  }

  return "Revise os dados e tente novamente.";
}

export async function createEventLeadAction(formData: FormData) {
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const parsed = eventLeadSchema.safeParse({
    eventId: String(formData.get("eventId") ?? "").trim(),
    eventSlug,
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || undefined
  });

  if (!parsed.success) {
    redirect(`/lista/${eventSlug}?error=${encodeURIComponent(validationMessage(parsed.error))}`);
  }

  try {
    await createOrUpdateEventLead(parsed.data);
  } catch (error) {
    redirect(`/lista/${eventSlug}?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível concluir seu cadastro.")}`);
  }

  revalidatePath(`/admin/events/${parsed.data.eventId}/leads`);
  revalidatePath(`/admin/events/${parsed.data.eventId}`);
  redirect(`/lista/${eventSlug}/obrigado`);
}
