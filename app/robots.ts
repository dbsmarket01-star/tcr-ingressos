import type { MetadataRoute } from "next";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCanonicalPublicBaseUrl } from "@/features/seo/public-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const context = await getCurrentOrganizationContext();
  const appUrl = getCanonicalPublicBaseUrl(context);

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/evento/"],
      disallow: ["/admin/", "/api/", "/login", "/pedido/", "/ingresso/"]
    },
    sitemap: `${appUrl}/sitemap.xml`
  };
}
