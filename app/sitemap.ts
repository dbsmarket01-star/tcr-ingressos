import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getAppUrl();
  let events: Array<{ slug: string; updatedAt: Date }> = [];

  try {
    events = await prisma.event.findMany({
      where: {
        status: "PUBLISHED"
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
      lastModified: new Date(),
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
