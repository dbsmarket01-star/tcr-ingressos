import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import manifest from "@/data/legacy-site/manifest.json";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acervo do site antigo | TCR Ingressos", robots: { index: false, follow: false } };

type Props = { params: Promise<{ path?: string[] }> };

export default async function LegacySitePage({ params }: Props) {
  const admin = await requireAdmin();
  const organization = await prisma.organization.findFirst({
    where: { id: admin.organizationId, slug: "tcr-ingressos" },
    select: { id: true }
  });
  if (!organization) notFound();

  const segments = (await params).path ?? [];
  const slug = segments.length === 0 ? "home" : segments.length === 2 && segments[0] === "evento" ? segments[1] : null;
  const event = manifest.events.find((entry) => entry.slug === slug);
  if (!slug || (slug !== "home" && !event)) notFound();

  const html = await readFile(path.join(process.cwd(), "data", "legacy-site", `${slug}.html`), "utf8");
  return (
    <main style={{ minHeight: "100vh", background: "#edf0f2", color: "#1f2937", fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 20px", background: "#17212b", color: "white" }}>
        <div>
          <strong>Acervo do site antigo da TCR</strong>
          <div style={{ fontSize: 13, marginTop: 4 }}>Cópia de consulta capturada em 21/11/2026. Vendas, login e busca desativados.</div>
        </div>
        <nav style={{ display: "flex", gap: 18 }}>
          <Link href="/admin/site-antigo" style={{ color: "white" }}>Início do acervo</Link>
          <Link href="/admin" style={{ color: "white" }}>Painel atual</Link>
        </nav>
      </header>
      <iframe
        title={event ? `Site antigo: ${event.title}` : "Página inicial do site antigo"}
        srcDoc={html}
        sandbox="allow-top-navigation-by-user-activation"
        referrerPolicy="no-referrer"
        style={{ display: "block", width: "100%", height: "calc(100vh - 74px)", minHeight: 680, border: 0 }}
      />
    </main>
  );
}
