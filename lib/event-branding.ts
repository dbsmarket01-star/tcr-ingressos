import type { OrganizationContext } from "@/features/organizations/organization.service";

export const A2_IMERGIDOS_LOGO_URL =
  "https://xbvrlheevlchxdkrsbnq.supabase.co/storage/v1/object/public/event-media/brands/a2-imergidos-logo.png";

type EventBrandingSource = {
  slug: string;
  title: string;
};

export function isA2ImergidosEvent(event: EventBrandingSource) {
  const slug = event.slug.toLowerCase();
  const title = event.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return slug.includes("a2-imergidos") || title.includes("a2 imergidos");
}

export function getPublicEventBranding(organizationContext: OrganizationContext, event: EventBrandingSource) {
  if (isA2ImergidosEvent(event)) {
    return {
      brandName: "A2 Imergidos",
      brandMark: "A",
      brandLogoUrl: A2_IMERGIDOS_LOGO_URL,
      homeHref: `/evento/${event.slug}`
    };
  }

  return {
    brandName: organizationContext.brandName,
    brandMark: organizationContext.brandMark,
    brandLogoUrl: organizationContext.brandLogoUrl,
    homeHref: organizationContext.publicBaseUrl || "/"
  };
}
