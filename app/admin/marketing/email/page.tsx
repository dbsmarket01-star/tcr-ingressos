import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MarketingEmailPage() {
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
      startsAt: true,
      city: true,
      state: true,
      _count: {
        select: {
          leads: true,
          leadEmailCampaigns: true
        }
      }
    }
  });

  return (
    <AdminShell
      title="Disparos de e-mail"
      description="Acesse os leads de cada evento para criar campanhas, acompanhar entregas, falhas, aberturas e cliques."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Disparos de e-mail">
        <article className="operationCommandCard">
          <span className="eyebrow">Marketing e vendas</span>
          <h2>Crie campanhas por evento da {organizationContext.brandName}.</h2>
          <p>
            Escolha um evento, clique em criar campanha nova, importe uma lista externa e dispare somente para esses contatos.
          </p>
        </article>
        <div className="operationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/crm">
            Kanban
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/marketing/whatsapp">
            WhatsApp
          </Link>
        </div>
      </section>

      <section className="card adminPanelBlock spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Eventos com disparo de e-mail</h2>
            <p className="muted">Escolha qual evento/marca será usado no e-mail e importe a lista externa da campanha.</p>
          </div>
        </div>
        {events.length === 0 ? (
          <div className="empty">Nenhum evento disponivel para disparo.</div>
        ) : (
          <div className="tableScroll wideTableScroll adminTableWrap">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Local</th>
                  <th>Leads</th>
                  <th>Campanhas</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                    </td>
                    <td>{formatDateTime(event.startsAt)}</td>
                    <td>{event.city}, {event.state}</td>
                    <td>{event._count.leads}</td>
                    <td>{event._count.leadEmailCampaigns}</td>
                    <td>
                      <div className="tableActions">
                        <Link className="button smallButton" href={`/admin/events/${event.id}/leads#lead-import`}>
                          Criar campanha nova
                        </Link>
                        <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/leads`}>
                          Ver campanhas
                        </Link>
                      </div>
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
