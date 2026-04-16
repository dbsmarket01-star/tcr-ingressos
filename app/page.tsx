import Link from "next/link";
import { adminNavItems, phaseOneModules } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="heroInner">
          <div className="brand" aria-label="TCR Ingressos">
            <span className="brandMark">T</span>
            <span>TCR Ingressos</span>
          </div>
          <h1>TCR Ingressos</h1>
          <p>
            Bilheteria propria para operacao interna da TCR: eventos, lotes, pedidos,
            pagamentos, ingressos com QR Code, check-in e dashboard administrativo.
          </p>
          <Link className="button" href="/admin">
            Abrir painel
          </Link>
        </div>
      </section>

      <section className="container">
        <div className="sectionHeader">
          <h2>Fundacao da Fase 1</h2>
          <Link className="secondaryButton" href="/evento/tcr-festival-2026">
            Exemplo publico
          </Link>
        </div>

        <div className="grid dashboardGrid">
          {phaseOneModules.map((module) => (
            <article className="card metric" key={module}>
              <span className="muted">Modulo preparado</span>
              <strong>{module}</strong>
            </article>
          ))}
        </div>

        <div className="sectionHeader">
          <h2>Areas do painel</h2>
        </div>
        <div className="grid cardsGrid">
          {adminNavItems.map((item) => (
            <Link className="card linkCard" href={item.href} key={item.href}>
              <h3>{item.label}</h3>
              <p className="muted">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
