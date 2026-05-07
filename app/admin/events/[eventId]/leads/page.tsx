import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CopyButton } from "@/components/forms/CopyButton";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { countEventPageVisits } from "@/features/analytics/page-visit.service";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import {
  deleteLeadBroadcastTemplateAction,
  saveLeadBroadcastTemplateAction,
  sendLeadBroadcastAction
} from "@/features/leads/lead.admin.actions";
import { getMunicipalityRanking } from "@/features/leads/lead-normalization";
import {
  getActiveLeadEmailCampaign,
  listEventLeads,
  listLeadEmailCampaignSummaries,
  listLeadEmailTemplates
} from "@/features/leads/lead.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { formatDateTime } from "@/lib/format";
import { getPublicLeadCaptureUrl } from "@/lib/public-url";
import { getLeadOriginBucket, getSourceLabel } from "@/features/tracking/tracking";
import { LeadBroadcastPreview } from "./LeadBroadcastPreview";
import { LeadBroadcastCampaignRunner } from "./LeadBroadcastCampaignRunner";
import { LeadBroadcastDestinationHelper } from "./LeadBroadcastDestinationHelper";
import { LeadBroadcastTemplates } from "./LeadBroadcastTemplates";
import { LeadBroadcastSubmitButton } from "./LeadBroadcastSubmitButton";

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

  const [leads, emailCampaigns, leadCaptureVisits, companySettings, savedTemplates, activeCampaign] = await Promise.all([
    listEventLeads(event.id),
    listLeadEmailCampaignSummaries(event.id),
    countEventPageVisits(event.id, "LEAD_CAPTURE"),
    getCompanySettingsByOrganizationId(admin.organizationId!),
    listLeadEmailTemplates(event.id),
    getActiveLeadEmailCampaign(event.id)
  ]);
  const leadsWithPhone = leads.filter((lead) => Boolean(lead.phone)).length;
  const leadsWithEmail = leads.filter((lead) => Boolean(lead.email)).length;
  const leadsWithMunicipality = leads.filter((lead) => Boolean(lead.municipality)).length;
  const thankYouViews = leads.filter((lead) => Boolean(lead.thankYouViewedAt)).length;
  const whatsappClicks = leads.filter((lead) => Boolean(lead.whatsappClickedAt)).length;
  const exportHref = `/admin/events/${event.id}/leads/export`;
  const publicLandingUrl = getPublicLeadCaptureUrl(event.slug);
  const sendResult = typeof query.sent === "string" ? query.sent : null;
  const queuedCampaignId = typeof query.queued === "string" ? query.queued : null;
  const sendError = typeof query.error === "string" ? query.error : null;
  const sendMode = typeof query.mode === "string" ? query.mode : null;
  const sendScope = typeof query.scope === "string" ? query.scope : null;
  const templateSaved = typeof query.templateSaved === "string" ? query.templateSaved : null;
  const templateDeleted = typeof query.templateDeleted === "string" ? query.templateDeleted : null;
  const templateError = typeof query.templateError === "string" ? query.templateError : null;
  const municipalityRanking = getMunicipalityRanking(leads.map((lead) => lead.municipality));
  const originRanking = Array.from(
    leads.reduce((acc, lead) => {
      const key = getLeadOriginBucket(lead.utmSource, lead.utmMedium);
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  ).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"));
  const totalLeads = leads.length || 1;

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
            <span className="muted">Visitas à landing</span>
            <strong>{leadCaptureVisits}</strong>
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
          <div className="card metric">
            <span className="muted">Viu a página de obrigado</span>
            <strong>{thankYouViews}</strong>
          </div>
          <div className="card metric">
            <span className="muted">Clicou no grupo</span>
            <strong>{whatsappClicks}</strong>
          </div>
        </div>
        {sendError ? <div className="errorBox">{sendError}</div> : null}
      </section>

      <section className="card spacedSection" id="lead-broadcast">
        <div className="sectionHeader">
          <div>
            <h2>E-mail para a lista</h2>
            <p className="muted">Dispare para toda a base, filtre por período/município ou envie um teste para uma pessoa só.</p>
          </div>
        </div>
        <div className="infoBox inlineFeedbackBox">
          Para enviar para <strong>toda a lista</strong>, deixe <strong>Data inicial</strong>, <strong>Data final</strong>, <strong>Municípios</strong> e <strong>E-mail de teste individual</strong> em branco.
        </div>
        {queuedCampaignId ? (
          <div className="infoBox inlineFeedbackBox">
            Campanha criada para a fila de envio.
            {sendScope ? <small className="feedbackScopeText">{sendScope}</small> : null}
          </div>
        ) : null}
        {sendResult ? (
          <div className="successBox inlineFeedbackBox">
            {sendMode === "test" ? `Teste enviado com sucesso para ${sendResult} destinatário.` : `Disparo concluído para ${sendResult} lead(s).`}
            {sendScope ? <small className="feedbackScopeText">{sendScope}</small> : null}
          </div>
        ) : null}
        {sendError ? <div className="errorBox inlineFeedbackBox">{sendError}</div> : null}
        {templateSaved ? <div className="successBox inlineFeedbackBox">Modelo salvo com sucesso.</div> : null}
        {templateDeleted ? <div className="successBox inlineFeedbackBox">Modelo apagado com sucesso.</div> : null}
        {templateError ? <div className="errorBox inlineFeedbackBox">{templateError}</div> : null}
        {activeCampaign ? (
          <LeadBroadcastCampaignRunner
            initialCampaign={{
              ...activeCampaign,
              pendingCount: Math.max(activeCampaign.totalCount - activeCampaign.sentCount - activeCampaign.failedCount, 0),
              createdAt: activeCampaign.createdAt.toISOString(),
              processingStartedAt: activeCampaign.processingStartedAt?.toISOString() ?? null,
              completedAt: activeCampaign.completedAt?.toISOString() ?? null
            }}
          />
        ) : null}
        <form action={sendLeadBroadcastAction} className="stackForm leadBroadcastFormLayout">
          <input type="hidden" name="eventId" value={event.id} />
          <div className="leadBroadcastComposerGrid">
            <div className="leadBroadcastComposerColumn">
              <section className="leadBroadcastSectionCard">
                <div className="leadBroadcastSectionHeader">
                  <strong>Modelo da campanha</strong>
                  <small>Use um ponto de partida, salve até 3 modelos seus e reaplique quando quiser.</small>
                </div>
                <LeadBroadcastTemplates
                  savedTemplates={savedTemplates}
                  deleteAction={deleteLeadBroadcastTemplateAction}
                />
                <div className="leadTemplateFooter">
                  <button className="secondaryButton smallButton" formAction={saveLeadBroadcastTemplateAction} type="submit">
                    Salvar este e-mail
                  </button>
                  <small className="muted">Salva assunto e mensagem atual. A imagem não entra no modelo.</small>
                </div>
              </section>

              <section className="leadBroadcastSectionCard">
                <div className="leadBroadcastSectionHeader">
                  <strong>Conteúdo do e-mail</strong>
                  <small>Assunto, mensagem principal, botão e destino final.</small>
                </div>
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
                <div className="grid twoColumnGrid">
                  <label className="field">
                    <span>Texto do botão</span>
                    <input
                      name="ctaLabel"
                      defaultValue="Entrar no grupo agora"
                      placeholder="Ex.: Entrar no grupo agora"
                    />
                  </label>
                  <label className="field">
                    <span>Link de destino</span>
                    <input
                      name="destinationUrl"
                      defaultValue={event.leadCaptureWhatsappGroupUrl ?? ""}
                      placeholder="https://chat.whatsapp.com/... ou outro link"
                    />
                  </label>
                </div>
                {event.leadCaptureWhatsappGroupUrl ? (
                  <LeadBroadcastDestinationHelper eventGroupUrl={event.leadCaptureWhatsappGroupUrl} />
                ) : (
                  <small className="muted">
                    O link digitado em <strong>Link de destino</strong> é o que vai no e-mail. Se esse campo ficar vazio, não há grupo padrão configurado no evento.
                  </small>
                )}
                <label className="field">
                  <span>Instagram no rodapé</span>
                  <input
                    name="instagramUrl"
                    defaultValue={companySettings?.instagramUrl ?? ""}
                    placeholder="https://instagram.com/tcringressos ou @tcringressos"
                  />
                </label>
              </section>

              <div className="leadBroadcastFilterCard">
                <div className="leadBroadcastFilterHeader">
                  <strong>Quem vai receber</strong>
                  <small>Sem filtro, o disparo vai para toda a lista. Para um dia só, repita a mesma data no início e no fim.</small>
                </div>
                <div className="grid twoColumnGrid">
                  <label className="field">
                    <span>Data inicial</span>
                    <input name="dateFrom" type="date" />
                  </label>
                  <label className="field">
                    <span>Data final</span>
                    <input name="dateTo" type="date" />
                  </label>
                </div>
                <label className="field">
                  <span>Municípios</span>
                  <textarea
                    name="municipalities"
                    rows={3}
                    placeholder={`Ex.: Santo André, São Bernardo\nVocê pode separar por vírgula ou uma cidade por linha.`}
                  />
                </label>
                <label className="field">
                  <span>E-mail de teste individual</span>
                  <input
                    name="testRecipientEmail"
                    placeholder="Se preencher aqui, o sistema envia só para esse e-mail."
                    type="email"
                  />
                </label>
              </div>

              <section className="leadBroadcastSectionCard">
                <div className="leadBroadcastSectionHeader">
                  <strong>Mídia do e-mail</strong>
                  <small>Imagem opcional. Para melhor resultado, use banner horizontal.</small>
                </div>
                <ImageUploadField
                  aspect="share"
                  applyMode="manual"
                  cropFieldName="imageCrop"
                  includeImageMetaFields
                  emptyText="Nenhuma imagem selecionada"
                  label="Imagem opcional"
                  name="imageFile"
                  recommendedSize="1200 x 630 px"
                  usageHint="Use um banner horizontal e ajuste o recorte com zoom, topo, base e laterais antes de enviar."
                />
              </section>
            </div>

            <div className="leadBroadcastComposerColumn leadBroadcastPreviewColumn">
              <LeadBroadcastPreview
                brandName="TCR Ingressos"
                defaultCtaLabel="Entrar no grupo agora"
                defaultDestinationUrl={event.leadCaptureWhatsappGroupUrl ?? ""}
                eventTitle={event.title}
                defaultInstagramUrl={companySettings?.instagramUrl ?? ""}
                supportEmail={companySettings?.supportEmail ?? null}
              />
            </div>
          </div>
          <div className="actionRow leadBroadcastActionRow leadBroadcastFooterBar">
            <LeadBroadcastSubmitButton disabledExternally={Boolean(activeCampaign)} />
            <small className="muted">
              {activeCampaign
                ? "Há uma campanha em andamento. Aguarde a conclusão para iniciar outro disparo."
                : "O botão trava enquanto o disparo está em andamento para evitar envio duplicado."}
            </small>
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
                {municipalityRanking.slice(0, 8).map((entry) => (
                  <div key={entry.label} className="leadInsightRow">
                    <span>{entry.label}</span>
                    <strong>
                      {entry.count} <small>({Math.round((entry.count / totalLeads) * 100)}%)</small>
                    </strong>
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
                    <strong>
                      {count} <small>({Math.round((count / totalLeads) * 100)}%)</small>
                    </strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {emailCampaigns.length > 0 ? (
        <section className="card spacedSection">
          <div className="sectionHeader">
            <div>
              <h2>Termômetro dos e-mails</h2>
              <p className="muted">Acompanhe quantas pessoas receberam e clicaram em cada disparo.</p>
            </div>
          </div>
          <div className="leadInsightList campaignInsightList">
            {emailCampaigns.slice(0, 8).map((campaign) => {
              const clicks = campaign._count.clicks;
              const opens = campaign._count.opens;
              const openRate = campaign.sentCount > 0 ? Math.round((opens / campaign.sentCount) * 100) : 0;
              const ctr = campaign.sentCount > 0 ? Math.round((clicks / campaign.sentCount) * 100) : 0;

              return (
                <div key={campaign.id} className="campaignInsightRow">
                  <div>
                    <strong>{campaign.subject}</strong>
                    <small>
                      {formatDateTime(campaign.createdAt)} · {campaign.ctaLabel || "Abrir link"} · {campaign.status}
                    </small>
                  </div>
                  <div className="campaignInsightStats">
                    <span>{campaign.totalCount} na fila</span>
                    <span>{campaign.sentCount} enviados</span>
                    <span>{campaign.failedCount} falhas</span>
                    <span>{opens} aberturas</span>
                    <span>{clicks} cliques</span>
                    <strong>{openRate}% open rate</strong>
                    <strong>{ctr}% CTR</strong>
                  </div>
                </div>
              );
            })}
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
