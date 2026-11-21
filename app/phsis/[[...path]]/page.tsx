import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import manifest from "@/data/legacy-site/manifest.json";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Acervo histórico | TCR Ingressos",
  robots: { index: false, follow: false }
};

type Props = { params: Promise<{ path?: string[] }> };

export default async function PublicLegacyArchivePage({ params }: Props) {
  const segments = (await params).path ?? [];
  const slug = segments.length === 0 ? "home" : segments.length === 2 && segments[0] === "evento" ? segments[1] : null;
  const event = manifest.events.find((entry) => entry.slug === slug);
  if (!slug || (slug !== "home" && !event)) notFound();

  const html = (await readFile(path.join(process.cwd(), "data", "legacy-site", `${slug}.html`), "utf8"))
    .replaceAll("/admin/site-antigo", "/phsis");

  return (
    <main style={{ minHeight: "100vh", background: "#edf0f2" }}>
      <iframe
        title={event ? `Site antigo: ${event.title}` : "Página inicial do site antigo"}
        srcDoc={html}
        sandbox="allow-top-navigation-by-user-activation"
        referrerPolicy="no-referrer"
        style={{ display: "block", width: "100%", height: "100vh", border: 0 }}
      />
    </main>
  );
}
