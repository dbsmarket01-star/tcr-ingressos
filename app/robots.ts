import type { MetadataRoute } from "next";

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/evento/"],
      disallow: ["/admin/", "/api/", "/login", "/pedido/", "/ingresso/"]
    },
    sitemap: `${appUrl}/sitemap.xml`
  };
}
