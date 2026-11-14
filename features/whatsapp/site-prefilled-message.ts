import { A2_IMERGIDOS_ORGANIZATION_SLUG } from "@/features/organizations/organization.service";

export function getSiteEventWhatsappMessage(organizationSlug: string, eventTitle: string) {
  if (organizationSlug === A2_IMERGIDOS_ORGANIZATION_SLUG) {
    return `Olá, vim do site do A2 e quero tirar uma dúvida sobre o evento ${eventTitle}.`;
  }

  return `Quero tirar uma dúvida no site da TCR Ingressos sobre o evento ${eventTitle}.`;
}
