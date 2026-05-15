import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MarketingSeoPage() {
  const admin = await requirePermission("MARKETING");
  const organizationContext = await getCurrentOrganizationContext();
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const events = await prisma.event.findMany({
    where: {
      organizationId: admin.organizationId,
      status: {
        not: "DRAFT"
      },
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
    },
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      city: true,
      state: true,
      bannerUrl: true,
      description: true,
      organization: {
        select: {
          publicDomain: true
        }
      }
    }
  });

  return (
    <AdminShell
      title="SEO"
      description="Central para revisar presença nos buscadores, links públicos e compartilhamento dos eventos."
    >
      <section className="operationCommandStrip spacedSection" aria-label="SEO dos eventos">
        <article className="operationCommandCard">
          <span className="eyebrow">Marketing</span>
          <h2>SEO e compartilhamento da {organizationContext.brandName}.</h2>
          <p>
            Aqui ficam os eventos publicados, com leitura rápida do que precisa estar pronto para Google, WhatsApp, Instagram e links de campanha.
          </p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/marketing/email">
            E-mail
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/marketing/whatsapp">
            WhatsApp
          </Link>
        </div>
      </section>

      <section className="grid dashboardGrid commercialSummaryGrid">
        <article className="card metric">
          <span className="muted">Eventos revisáveis</span>
          <strong>{events.length}</strong>
          <small>Eventos publicados ou em operação.</small>
        </article>
        <article className="card metric">
          <span className="muted">Com banner</span>
          <strong>{events.filter((event) => Boolean(event.bannerUrl)).length}</strong>
          <small>Importante para compartilhamento.</small>
        </article>
        <article className="card metric">
          <span className="muted">Com descrição</span>
          <strong>{events.filter((event) => Boolean(event.description?.trim())).length}</strong>
          <small>Base para SEO e anúncios.</small>
        </article>
        <article className="card dashboardHeroMetric metric">
          <span className="muted">Domínio público</span>
          <strong>{organizationContext.organization.publicDomain ? "OK" : "Pendente"}</strong>
          <small>{organizationContext.organization.publicDomain || "Configure o domínio público."}</small>
        </article>
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Eventos e presença pública</h2>
            <p className="muted">Revise os pontos básicos antes de tráfego pago ou divulgação orgânica.</p>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="empty">Nenhum evento disponível para revisão de SEO.</div>
        ) : (
          <div className="tableScroll wideTableScroll adminTableWrap">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Local</th>
                  <th>Banner</th>
                  <th>Descrição</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      <span className="muted">/evento/{event.slug}</span>
                    </td>
                    <td>{formatDateTime(event.startsAt)}</td>
                    <td>{event.city}, {event.state}</td>
                    <td>{event.bannerUrl ? "OK" : "Pendente"}</td>
                    <td>{event.description?.trim() ? "OK" : "Pendente"}</td>
                    <td>
                      <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/edit`}>
                        Ajustar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
