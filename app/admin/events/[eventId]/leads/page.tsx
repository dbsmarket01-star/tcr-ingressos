import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/forms/CopyButton";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { listEventLeads } from "@/features/leads/lead.service";
import { formatDateTime } from "@/lib/format";
import { getPublicLeadCaptureUrl } from "@/lib/public-url";
import { getSourceLabel } from "@/features/tracking/tracking";

type EventLeadsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventLeadsPage({ params }: EventLeadsPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  await requireEventAccess(eventId);
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    notFound();
  }

  const leads = await listEventLeads(event.id);
  const leadsWithPhone = leads.filter((lead) => Boolean(lead.phone)).length;
  const leadsWithEmail = leads.filter((lead) => Boolean(lead.email)).length;
  const exportHref = `/admin/events/${event.id}/leads/export`;
  const publicLandingUrl = getPublicLeadCaptureUrl(event.slug);

  function getWhatsappUrl(phone?: string | null) {
    const digits = (phone ?? "").replace(/\D/g, "");
    return digits ? `https://wa.me/55${digits}` : null;
  }

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
            <CopyButton
              className="secondaryButton smallButton"
              value={publicLandingUrl}
              label="Copiar link"
              copiedLabel="Link copiado"
            />
            <Link className="secondaryButton smallButton" href={`${getPublicLeadCaptureUrl(event.slug)}/obrigado`} target="_blank">
              Abrir obrigado
            </Link>
            <Link className="button smallButton" href={exportHref}>
              Exportar CSV
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
          <div className="card metric">
            <span className="muted">Com WhatsApp</span>
            <strong>{leadsWithPhone}</strong>
          </div>
          <div className="card metric">
            <span className="muted">Com e-mail</span>
            <strong>{leadsWithEmail}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Cadastros recebidos</h2>
            <p className="muted">Esses contatos vieram da landing separada da venda de ingressos.</p>
          </div>
          {leads.length > 0 ? (
            <div className="actionRow">
              <Link className="secondaryButton smallButton" href={exportHref}>
                Baixar planilha
              </Link>
            </div>
          ) : null}
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
                  <th>Origem</th>
                  <th>Cadastrado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.name}</td>
                    <td>{lead.email}</td>
                    <td>{lead.phone || "-"}</td>
                    <td>{getSourceLabel(lead.utmSource, lead.utmMedium)}</td>
                    <td>{formatDateTime(lead.createdAt)}</td>
                    <td>
                      <div className="tableActions">
                        <a className="secondaryButton smallButton" href={`mailto:${lead.email}`}>
                          E-mail
                        </a>
                        {getWhatsappUrl(lead.phone) ? (
                          <a
                            className="secondaryButton smallButton"
                            href={getWhatsappUrl(lead.phone) || "#"}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            WhatsApp
                          </a>
                        ) : null}
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
