"use server";

import { redirect } from "next/navigation";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { resendPublicAccessEmailsByCustomerEmail } from "@/features/support/support.service";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function resendPublicAccessByEmailAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const organizationContext = await getCurrentOrganizationContext();

  if (!email || !email.includes("@")) {
    redirect(`/meus-ingressos?error=${encodeURIComponent("Informe um e-mail válido.")}`);
  }

  try {
    const result = await resendPublicAccessEmailsByCustomerEmail(email, organizationContext.organization.id);
    const successMessage =
      result.sentPending > 0
        ? `Enviamos seus acessos para ${result.email}. Verifique sua caixa de entrada e também o spam.`
        : `Reenviamos seus ingressos para ${result.email}. Verifique sua caixa de entrada e também o spam.`;

    redirect(`/meus-ingressos?email=${encodeURIComponent(email)}&sent=1&success=${encodeURIComponent(successMessage)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível reenviar seus acessos agora.";
    redirect(`/meus-ingressos?email=${encodeURIComponent(email)}&error=${encodeURIComponent(message)}`);
  }
}
