import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EventEmailCampaignsPage() {
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
      title="Campanhas de e-mail por evento"
      description="Crie disparos usando os leads captados nas páginas de eventos já cadastrados."
    >
      <div className="spacedSection tableActions">
        <Link className="secondaryButton smallButton" href="/admin/marketing/email">
          Voltar para opções de e-mail
        </Link>
        <Link className="button smallButton" href="/admin/marketing/email/campaigns">
          Criar campanha do zero
        </Link>
      </div>

      <section className="operationCommandStrip spacedSection" aria-label="Campanhas de e-mail por evento">
        <article className="operationCommandCard">
          <span className="eyebrow">Marketing e vendas</span>
          <h2>Campanhas por evento da {organizationContext.brandName}.</h2>
          <p>
            Escolha um evento para acessar os leads captados na landing, importar contatos adicionais daquele evento e acompanhar os disparos já feitos.
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
            <p className="muted">
              Use este fluxo quando quiser criar campanhas a partir dos leads captados em um evento.
            </p>
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
                    <td>
                      {event.city}, {event.state}
                    </td>
                    <td>{event._count.leads}</td>
                    <td>{event._count.leadEmailCampaigns}</td>
                    <td>
                      <div className="tableActions">
                        <Link className="button smallButton" href={`/admin/events/${event.id}/leads#lead-import`}>
                          Criar campanha do evento
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
