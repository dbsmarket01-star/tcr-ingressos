import type { OrganizationContext } from "@/features/organizations/organization.service";

export function getCanonicalPublicBaseUrl(context: OrganizationContext) {
  if (context.organization.slug === "tcr-ingressos") {
    return "https://www.tcringressos.app.br";
  }

  return context.publicBaseUrl.replace(/\/$/, "");
}
