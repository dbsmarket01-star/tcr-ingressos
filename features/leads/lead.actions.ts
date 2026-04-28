"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { eventLeadSchema } from "./lead.schema";
import { createOrUpdateEventLead } from "./lead.service";
import { verifyTurnstileToken } from "./turnstile.service";

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

async function getClientIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return requestHeaders.get("x-real-ip")?.trim() || null;
}

export async function createEventLeadAction(formData: FormData) {
  const eventSlug = String(formData.get("eventSlug") ?? "").trim();
  const honeypot = String(formData.get("company") ?? "").trim();

  if (honeypot) {
    redirect(`/lista/${eventSlug}/obrigado`);
  }

  const parsed = eventLeadSchema.safeParse({
    eventId: String(formData.get("eventId") ?? "").trim(),
    eventSlug,
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    utmSource: String(formData.get("utmSource") ?? "").trim() || undefined,
    utmMedium: String(formData.get("utmMedium") ?? "").trim() || undefined,
    utmCampaign: String(formData.get("utmCampaign") ?? "").trim() || undefined,
    utmContent: String(formData.get("utmContent") ?? "").trim() || undefined,
    utmTerm: String(formData.get("utmTerm") ?? "").trim() || undefined,
    referrer: String(formData.get("referrer") ?? "").trim() || undefined,
    landingPage: String(formData.get("landingPage") ?? "").trim() || undefined
  });

  if (!parsed.success) {
    redirect(`/lista/${eventSlug}?error=${encodeURIComponent(validationMessage(parsed.error))}`);
  }

  try {
    const organizationContext = await getCurrentOrganizationContext();
    const clientIp = await getClientIp();
    await verifyTurnstileToken(String(formData.get("cf-turnstile-response") ?? "").trim() || null, clientIp);
    const result = await createOrUpdateEventLead(parsed.data, organizationContext.organization.id, clientIp);
    revalidatePath(`/admin/events/${parsed.data.eventId}/leads`);
    revalidatePath(`/admin/events/${parsed.data.eventId}`);

    if (result.isExisting) {
      redirect(`/lista/${eventSlug}/obrigado?existing=1`);
    }
  } catch (error) {
    redirect(`/lista/${eventSlug}?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível concluir seu cadastro.")}`);
  }
  redirect(`/lista/${eventSlug}/obrigado`);
}
