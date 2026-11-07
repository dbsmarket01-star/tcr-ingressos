import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCanonicalPublicBaseUrl } from "@/features/seo/public-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const context = await getCurrentOrganizationContext();
  const appUrl = getCanonicalPublicBaseUrl(context);
  const now = new Date();
  let events: Array<{ slug: string; updatedAt: Date }> = [];

  try {
    events = await prisma.event.findMany({
      where: {
        organizationId: context.organization.id,
        status: "PUBLISHED",
        OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }]
      },
      orderBy: {
        startsAt: "desc"
      },
      select: {
        slug: true,
        updatedAt: true
      }
    });
  } catch (error) {
    console.error("[sitemap] Nao foi possivel carregar eventos publicados", error);
  }

  return [
    {
      url: appUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8
    },
    ...events.map((event) => ({
      url: `${appUrl}/evento/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9
    }))
  ];
}
