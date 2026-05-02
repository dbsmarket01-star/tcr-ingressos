import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/forms/CopyButton";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { sendLeadBroadcastAction } from "@/features/leads/lead.admin.actions";
import { listEventLeads } from "@/features/leads/lead.service";
import { formatDateTime } from "@/lib/format";
import { getPublicLeadCaptureUrl } from "@/lib/public-url";
import { getLeadOriginBucket, getSourceLabel } from "@/features/tracking/tracking";

type EventLeadsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventLeadsPage({ params, searchParams }: EventLeadsPageProps) {
  const admin = await requirePermission("EVENTS");
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ eventId }, query] = await Promise.all([params, searchParams ? searchParams : Promise.resolve(emptySearchParams)]);
  await requireEventAccess(eventId);
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    notFound();
  }

  const leads = await listEventLeads(event.id);
  const leadsWithPhone = leads.filter((lead) => Boolean(lead.phone)).length;
  const leadsWithEmail = leads.filter((lead) => Boolean(lead.email)).length;
  const leadsWithMunicipality = leads.filter((lead) => Boolean(lead.municipality)).length;
  const exportHref = `/admin/events/${event.id}/leads/export`;
  const publicLandingUrl = getPublicLeadCaptureUrl(event.slug);
  const sendResult = typeof query.sent === "string" ? query.sent : null;
  const sendError = typeof query.error === "string" ? query.error : null;
  const municipalityRanking = Array.from(
    leads.reduce((acc, lead) => {
      const key = lead.municipality?.trim() || "Não informado";
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  ).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"));
  const originRanking = Array.from(
    leads.reduce((acc, lead) => {
      const key = getLeadOriginBucket(lead.utmSource, lead.utmMedium);
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  ).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"));

  function getWhatsappUrl(phone?: string | null) {
    const digits = (phone ?? "").replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
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
          <div className="card metric">
            <span className="muted">Com município</span>
            <strong>{leadsWithMunicipality}</strong>
          </div>
        </div>
        {sendResult ? <div className="successBox">Disparo concluído para {sendResult} lead(s).</div> : null}
        {sendError ? <div className="errorBox">{sendError}</div> : null}
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader">
          <div>
            <h2>E-mail para toda a lista</h2>
            <p className="muted">Escreva a mensagem e envie para todos os leads já cadastrados deste evento.</p>
          </div>
        </div>
        <form action={sendLeadBroadcastAction} className="stackForm">
          <input type="hidden" name="eventId" value={event.id} />
          <label className="field">
            <span>Assunto do e-mail</span>
            <input
              name="subject"
              placeholder="Ex.: Entre agora no grupo para garantir até 30% de desconto"
              required
            />
          </label>
          <label className="field">
            <span>Mensagem</span>
            <textarea
              name="body"
              placeholder={`Olá!\n\nEntrando no grupo agora você garante o desconto especial e recebe primeiro as próximas informações do evento.`}
              rows={7}
              required
            />
          </label>
          <label className="field">
            <span>Imagem opcional</span>
            <input accept="image/png,image/jpeg,image/webp,image/gif" name="imageFile" type="file" />
          </label>
          <div className="actionRow">
            <button className="button" type="submit">
              Enviar e-mail para todos os leads
            </button>
          </div>
        </form>
      </section>

      {leads.length > 0 ? (
        <section className="card spacedSection">
          <div className="sectionHeader">
            <div>
              <h2>Leitura comercial</h2>
              <p className="muted">Veja de onde vem mais interesse e quais municípios concentram mais cadastros.</p>
            </div>
          </div>
          <div className="leadInsightsGrid">
            <article className="leadInsightCard">
              <div className="leadInsightHeader">
                <strong>Municípios com mais leads</strong>
                <span>{municipalityRanking.length} grupos</span>
              </div>
              <div className="leadInsightList">
                {municipalityRanking.slice(0, 8).map(([municipality, count]) => (
                  <div key={municipality} className="leadInsightRow">
                    <span>{municipality}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="leadInsightCard">
              <div className="leadInsightHeader">
                <strong>Origem dos cadastros</strong>
                <span>{originRanking.length} grupos</span>
              </div>
              <div className="leadInsightList">
                {originRanking.map(([origin, count]) => (
                  <div key={origin} className="leadInsightRow">
                    <span>{origin}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

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
                  <th>Município</th>
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
                    <td>{lead.municipality || "-"}</td>
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
