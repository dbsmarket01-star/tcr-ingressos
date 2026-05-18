"use server";

import { redirect } from "next/navigation";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { resendPublicAccessEmailsByCustomerEmail } from "@/features/support/support.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function resendPublicAccessByEmailAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const eventId = String(formData.get("eventId") ?? "").trim();
  const organizationContext = await getCurrentOrganizationContext();

  if (!email || !email.includes("@")) {
    redirect(`/meus-ingressos?error=${encodeURIComponent("Informe um e-mail válido.")}`);
  }

  if (!eventId) {
    redirect(`/meus-ingressos?email=${encodeURIComponent(email)}&error=${encodeURIComponent("Escolha o evento para receber os ingressos.")}`);
  }

  try {
    const result = await resendPublicAccessEmailsByCustomerEmail(
      email,
      organizationContext.organization.id,
      eventId
    );
    const successMessage = `Reenviamos os ingressos selecionados para ${result.email}. Verifique sua caixa de entrada e também o spam.`;

    redirect(`/meus-ingressos?email=${encodeURIComponent(email)}&sent=1&success=${encodeURIComponent(successMessage)}`);
  } catch (error) {
    const message = getFriendlyErrorMessage(error, "Não foi possível reenviar seus acessos agora.");
    redirect(`/meus-ingressos?email=${encodeURIComponent(email)}&error=${encodeURIComponent(message)}`);
  }
}
