import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { listEventLeads } from "@/features/leads/lead.service";
import { formatDateTime } from "@/lib/format";
import { getPublicLeadCaptureUrl } from "@/lib/public-url";

type EventLeadsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventLeadsPage({ params }: EventLeadsPageProps) {
  await requirePermission("EVENTS");
  const { eventId } = await params;
  const event = await getEventForManagement(eventId);

  if (!event) {
    notFound();
  }

  const leads = await listEventLeads(event.id);

  return (
    <AdminShell
      title={`Leads - ${event.title}`}
      description="Cadastros da landing de interesse deste evento."
    >
      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Resumo da captação</h2>
            <p className="muted">Acompanhe os cadastros antes da abertura oficial da venda.</p>
          </div>
          <div className="actionRow">
            <Link className="secondaryButton smallButton" href={getPublicLeadCaptureUrl(event.slug)} target="_blank">
              Abrir landing
            </Link>
            <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/edit`}>
              Editar captação
            </Link>
          </div>
        </div>
        <div className="grid dashboardGrid">
          <div className="card metric">
            <span className="muted">Captação ativa</span>
            <strong>{event.leadCaptureEnabled ? "Sim" : "Não"}</strong>
          </div>
          <div className="card metric">
            <span className="muted">Total de leads</span>
            <strong>{leads.length}</strong>
          </div>
          <div className="card metric">
            <span className="muted">Último cadastro</span>
            <strong>{leads[0] ? formatDateTime(leads[0].createdAt) : "-"}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Cadastros recebidos</h2>
            <p className="muted">Esses contatos vieram da landing separada da venda de ingressos.</p>
          </div>
        </div>
        {leads.length === 0 ? (
          <div className="empty">Nenhum lead captado ainda para este evento.</div>
        ) : (
          <div className="tableScroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Cadastrado em</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.name}</td>
                    <td>{lead.email}</td>
                    <td>{lead.phone || "-"}</td>
                    <td>{formatDateTime(lead.createdAt)}</td>
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
