import Link from "next/link";

export const dynamic = "force-dynamic";

const pillars = [
  {
    title: "Bloqueio real",
    text: "DNS filtering, VPN local no Android, blocklists versionadas e telemetria de proteção."
  },
  {
    title: "Anti-bypass",
    text: "PIN local, desbloqueio supervisionado, parceiro de responsabilidade e trilha de incidentes."
  },
  {
    title: "SaaS operacional",
    text: "Planos, assinaturas, limite de dispositivos, billing Asaas e painel administrativo."
  }
];

const adminLinks = [
  { href: "/admin/security", label: "Centro de proteção" },
  { href: "/admin/devices", label: "Dispositivos" },
  { href: "/admin/incidents", label: "Incidentes" },
  { href: "/admin/unlocks", label: "Desbloqueios" },
  { href: "/admin/subscriptions", label: "Assinaturas" },
  { href: "/admin/billing", label: "Faturamento" }
];

export default function GuerraPornografiaPreviewPage() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #071b17 0%, #0f2b25 45%, #eadfcb 100%)", color: "#f4efe7" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 40px" }}>
        <div style={{ display: "grid", gap: 32, gridTemplateColumns: "1.2fr 0.8fr", alignItems: "start" }}>
          <div>
            <span style={{ display: "inline-block", padding: "8px 14px", borderRadius: 999, background: "rgba(240,245,240,0.12)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 12 }}>
              Guerra à Pornografia Preview
            </span>
            <h1 style={{ fontSize: "clamp(44px, 7vw, 84px)", lineHeight: 0.95, margin: "20px 0 18px", maxWidth: 760 }}>
              Proteção digital real para bloquear pornografia com fricção séria.
            </h1>
            <p style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 720, color: "rgba(244,239,231,0.84)" }}>
              Este preview mostra o produto novo que estamos construindo dentro do projeto: app mobile com proteção supervisionada,
              anti-bypass, painel web e controle comercial por assinatura.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
              <Link href="/admin/security" style={{ background: "#d6f26d", color: "#0f221d", padding: "14px 20px", borderRadius: 12, fontWeight: 800, textDecoration: "none" }}>
                Abrir Centro de Proteção
              </Link>
              <Link href="/admin/unlocks" style={{ border: "1px solid rgba(244,239,231,0.28)", color: "#f4efe7", padding: "14px 20px", borderRadius: 12, fontWeight: 700, textDecoration: "none" }}>
                Ver desbloqueios supervisionados
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 34 }}>
              {pillars.map((pillar) => (
                <article
                  key={pillar.title}
                  style={{
                    border: "1px solid rgba(244,239,231,0.12)",
                    background: "rgba(8, 27, 23, 0.42)",
                    borderRadius: 18,
                    padding: 20,
                    backdropFilter: "blur(10px)"
                  }}
                >
                  <strong style={{ display: "block", fontSize: 19, marginBottom: 8 }}>{pillar.title}</strong>
                  <p style={{ margin: 0, color: "rgba(244,239,231,0.8)", lineHeight: 1.5 }}>{pillar.text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside
            style={{
              background: "rgba(248, 245, 239, 0.92)",
              color: "#13211e",
              borderRadius: 22,
              padding: 24,
              boxShadow: "0 30px 80px rgba(0,0,0,0.22)"
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#4f6f66" }}>
              MVP em andamento
            </div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 34, lineHeight: 1.05 }}>O que já existe para ver</h2>
            <p style={{ margin: 0, color: "#425550", lineHeight: 1.6 }}>
              O root público ainda é o legado de ingressos. O núcleo novo já está visível principalmente nas áreas administrativas e nos fluxos de proteção.
            </p>

            <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
              {adminLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "#edf4ef",
                    color: "#15312b",
                    fontWeight: 700
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: 16, borderRadius: 16, background: "#13211e", color: "#e8e2d7" }}>
              <strong style={{ display: "block", marginBottom: 6 }}>Próxima visualização</strong>
              <span style={{ lineHeight: 1.5 }}>
                Assim que você quiser, eu também posso subir a versão Android em emulador para te mostrar a interface do app mobile.
              </span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
