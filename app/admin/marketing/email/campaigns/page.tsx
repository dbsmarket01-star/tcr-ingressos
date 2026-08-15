import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { requirePermission } from "@/features/auth/auth.service";
import {
  createMarketingEmailCampaignAction,
  importMarketingEmailContactsAction,
  saveMarketingEmailContentAction,
  sendMarketingEmailCampaignAction,
  sendMarketingEmailTestAction
} from "@/features/marketing-email/marketing-email.actions";
import {
  getMarketingEmailCampaign,
  getMarketingEmailCampaigns,
  getMarketingEmailStatusLabel
} from "@/features/marketing-email/marketing-email.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type MarketingEmailPageProps = {
  searchParams: Promise<{
    campaignId?: string;
    contentSaved?: string;
    created?: string;
    error?: string;
    importDuplicates?: string;
    importIgnored?: string;
    importInvalid?: string;
    importRecognized?: string;
    importTotal?: string;
    imported?: string;
    queued?: string;
    testSent?: string;
  }>;
};

function numberParam(value?: string) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getMessage(params: Awaited<MarketingEmailPageProps["searchParams"]>) {
  if (params.error) {
    return {
      tone: "danger" as const,
      title: "Algo precisa de atenção",
      text: params.error
    };
  }

  if (params.imported) {
    return {
      tone: "success" as const,
      title: "Lista carregada com sucesso",
      text:
        `${numberParam(params.importRecognized)} contato(s) reconhecido(s), ` +
        `${numberParam(params.importIgnored)} ignorado(s), ` +
        `${numberParam(params.importInvalid)} e-mail(s) inválido(s) e ` +
        `${numberParam(params.importDuplicates)} duplicado(s).`
    };
  }

  if (params.testSent) {
    return {
      tone: "success" as const,
      title: "Teste enviado",
      text: `O e-mail de teste foi enviado para ${params.testSent}.`
    };
  }

  if (params.queued) {
    return {
      tone: "success" as const,
      title: "Campanha em envio",
      text: "A campanha entrou na fila. Os status de envio, falhas, aberturas e cliques serão atualizados nesta tela."
    };
  }

  if (params.contentSaved) {
    return {
      tone: "success" as const,
      title: "Conteúdo salvo",
      text: "Assunto, mensagem, imagem e chamada foram salvos para esta campanha."
    };
  }

  if (params.created) {
    return {
      tone: "success" as const,
      title: "Campanha criada",
      text: "Agora monte o e-mail, envie um teste e depois importe a lista externa para o disparo."
    };
  }

  return null;
}

function statusToneClass(status: string) {
  if (status === "COMPLETED") return "paid";
  if (status === "FAILED" || status === "COMPLETED_WITH_ERRORS") return "canceled";
  if (status === "QUEUED" || status === "PROCESSING") return "pending";
  return "neutral";
}

export default async function MarketingEmailPage({ searchParams }: MarketingEmailPageProps) {
  const admin = await requirePermission("MARKETING");
  const params = await searchParams;
  const organizationContext = await getCurrentOrganizationContext();
  const campaigns = await getMarketingEmailCampaigns(admin.organizationId);
  const selectedCampaignId = params.campaignId || campaigns[0]?.id || "";
  const selectedCampaign = selectedCampaignId
    ? await getMarketingEmailCampaign(admin.organizationId, selectedCampaignId)
    : null;
  const message = getMessage(params);
  const selectedCampaignHasContent = Boolean(
    selectedCampaign?.subject && selectedCampaign.body && selectedCampaign.destinationUrl
  );
  const selectedCampaignHasRecipients = Boolean(selectedCampaign && selectedCampaign.metrics.recipients > 0);
  const selectedCampaignCanSend = selectedCampaignHasContent && selectedCampaignHasRecipients;
  const totals = campaigns.reduce(
    (acc, campaign) => {
      acc.recipients += campaign.metrics.recipients;
      acc.sent += campaign.metrics.sent;
      acc.failed += campaign.metrics.failed;
      acc.opens += campaign.metrics.opens;
      acc.clicks += campaign.metrics.clicks;

      return acc;
    },
    { clicks: 0, failed: 0, opens: 0, recipients: 0, sent: 0 }
  );

  return (
    <AdminShell
      title="Campanhas de e-mail"
      description="Crie campanhas externas independentes, envie testes, importe listas e acompanhe entregas."
    >
      <section className="emailCampaignDeskPage">
        <div className="emailCampaignTopActions">
          <Link className="ordersSecondaryButton" href="/admin/marketing/email">
            Voltar para opções
          </Link>
          <Link className="ordersSecondaryButton" href="/admin/marketing/email/events">
            Campanhas por evento
          </Link>
        </div>

        {message ? (
          <section className={`noticeCard notice-${message.tone}`}>
            <strong>{message.title}</strong>
            <p>{message.text}</p>
          </section>
        ) : null}

        <section className="ordersSummaryGrid" aria-label="Resumo das campanhas externas">
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconTotal">C</span>
            <div>
              <span>Campanhas criadas</span>
              <strong>{campaigns.length}</strong>
              <small>Fluxo independente de eventos</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconRevenue">@</span>
            <div>
              <span>Contatos importados</span>
              <strong>{totals.recipients}</strong>
              <small>Somente listas externas</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconPaid">OK</span>
            <div>
              <span>E-mails enviados</span>
              <strong>{totals.sent}</strong>
              <small>Entregas registradas</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconPending">!</span>
            <div>
              <span>Falhas</span>
              <strong>{totals.failed}</strong>
              <small>Revisar antes de reenvios</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconRevenue">IR</span>
            <div>
              <span>Aberturas / cliques</span>
              <strong>{totals.opens} / {totals.clicks}</strong>
              <small>Interações rastreadas</small>
            </div>
          </article>
        </section>

        <section className="ordersFilterPanel emailCampaignCreatePanel" aria-label="Criar campanha externa">
          <div className="ordersFilterHeader">
            <span>+</span>
            <div>
              <h2>Criar campanha nova</h2>
              <p>Comece do zero, sem depender de evento publicado ou lista de landing page.</p>
            </div>
          </div>
          <form action={createMarketingEmailCampaignAction} className="emailCampaignCreateForm">
            <label className="field">
              <span>Nome da campanha</span>
              <input name="name" placeholder="Ex.: Convite Fernandinho Santo André" required minLength={3} />
            </label>
            <SubmitButton className="ordersPrimaryButton" pendingText="Criando campanha...">
              Criar campanha nova
            </SubmitButton>
          </form>
        </section>

        <section className="emailCampaignWorkspace">
          <aside className="ordersTablePanel emailCampaignListPanel">
            <div className="ordersTableHeader">
              <div>
                <h2>Todas as campanhas</h2>
                <p>Selecione uma campanha para editar conteúdo, testar ou enviar.</p>
              </div>
            </div>
            {campaigns.length === 0 ? (
              <div className="ordersEmptyState">Nenhuma campanha criada ainda.</div>
            ) : (
              <div className="emailCampaignList">
                {campaigns.map((campaign) => (
                  <Link
                    className={`emailCampaignListItem ${campaign.id === selectedCampaign?.id ? "is-active" : ""}`}
                    href={`/admin/marketing/email/campaigns?campaignId=${campaign.id}`}
                    key={campaign.id}
                  >
                    <div className="emailCampaignListHeader">
                      <strong>{campaign.name}</strong>
                      <span className={`ordersStatusBadge ${statusToneClass(campaign.status)}`}>
                        {getMarketingEmailStatusLabel(campaign.status)}
                      </span>
                    </div>
                    <span className="emailCampaignDate">Criada em {formatDateTime(campaign.createdAt)}</span>
                    <div className="emailCampaignListStats">
                      <span>{campaign.metrics.recipients} contato(s)</span>
                      <span>{campaign.metrics.sent} enviado(s)</span>
                      <span>{campaign.metrics.failed} falha(s)</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>

          <main className="emailCampaignMain">
            {!selectedCampaign ? (
              <section className="ordersTablePanel">
                <div className="ordersEmptyState">Crie ou selecione uma campanha para começar.</div>
              </section>
            ) : (
              <>
                <section className="ordersTablePanel emailCampaignSelectedHeader">
                  <div className="emailCampaignSelectedTop">
                    <div>
                      <span className="eyebrow">Campanha selecionada</span>
                      <h2>{selectedCampaign.name}</h2>
                      <p>
                        Status: {getMarketingEmailStatusLabel(selectedCampaign.status)}
                        {selectedCampaign.importedAt ? ` · Lista importada em ${formatDateTime(selectedCampaign.importedAt)}` : ""}
                      </p>
                    </div>
                    <span className={`ordersStatusBadge ${statusToneClass(selectedCampaign.status)}`}>
                      {getMarketingEmailStatusLabel(selectedCampaign.status)}
                    </span>
                  </div>
                  {selectedCampaign.lastError ? (
                    <div className="noticeCard notice-danger">
                      <strong>Última falha</strong>
                      <p>{selectedCampaign.lastError}</p>
                    </div>
                  ) : null}
                  <div className="emailCampaignSelectedStats">
                    <article>
                      <span>Pendentes</span>
                      <strong>{selectedCampaign.metrics.pending + selectedCampaign.metrics.processing}</strong>
                    </article>
                    <article>
                      <span>Enviados</span>
                      <strong>{selectedCampaign.metrics.sent}</strong>
                    </article>
                    <article>
                      <span>Falhas</span>
                      <strong>{selectedCampaign.metrics.failed}</strong>
                    </article>
                    <article>
                      <span>Aberturas</span>
                      <strong>{selectedCampaign.metrics.opens}</strong>
                    </article>
                    <article>
                      <span>Cliques</span>
                      <strong>{selectedCampaign.metrics.clicks}</strong>
                    </article>
                  </div>
                </section>

                <section className="ordersFilterPanel emailCampaignComposerPanel" id="conteudo">
                  <div className="ordersFilterHeader">
                    <span>1</span>
                    <div>
                      <h2>Mensagem e teste</h2>
                      <p>Monte o e-mail e envie um teste antes de subir ou disparar qualquer lista.</p>
                    </div>
                  </div>
                  <div className="emailCampaignComposerGrid">
                    <form action={saveMarketingEmailContentAction} className="emailCampaignComposerFields">
                      <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                      <label className="field">
                        <span>Assunto</span>
                        <input
                          name="subject"
                          defaultValue={selectedCampaign.subject ?? ""}
                          placeholder="Ex.: Convite especial para você"
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Mensagem</span>
                        <textarea
                          name="body"
                          rows={8}
                          defaultValue={selectedCampaign.body ?? ""}
                          placeholder="Escreva a mensagem que será enviada para a lista."
                          required
                        />
                      </label>
                      <div className="emailCampaignFieldGrid">
                        <label className="field">
                          <span>Texto do botão</span>
                          <input name="ctaLabel" defaultValue={selectedCampaign.ctaLabel ?? ""} placeholder="Quero participar" />
                        </label>
                        <label className="field">
                          <span>Link de destino</span>
                          <input name="destinationUrl" defaultValue={selectedCampaign.destinationUrl ?? ""} placeholder="https://..." required />
                        </label>
                      </div>
                      <ImageUploadField
                        aspect="share"
                        applyMode="manual"
                        cropFieldName="imageCrop"
                        currentCropValue={selectedCampaign.imageCrop}
                        currentImageUrl={selectedCampaign.imageUrl}
                        includeImageMetaFields
                        emptyText="Nenhuma imagem selecionada"
                        label="Imagem opcional"
                        name="imageFile"
                        recommendedSize="1200 x 630 px"
                        usageHint="Use um banner horizontal e ajuste o recorte com zoom, topo, base e laterais antes de salvar."
                      />
                      <div className="emailCampaignActions">
                        <SubmitButton className="ordersPrimaryButton" pendingText="Salvando conteúdo...">
                          Salvar conteúdo
                        </SubmitButton>
                      </div>
                    </form>

                    <form action={sendMarketingEmailTestAction} className="emailCampaignTestBox">
                      <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                      <div>
                        <strong>Enviar teste</strong>
                        <p>Use seu próprio e-mail para conferir assunto, texto, imagem e botão antes do disparo.</p>
                      </div>
                      <label className="field">
                        <span>E-mail de teste</span>
                        <input name="testEmail" type="email" placeholder="dbsmarket01@gmail.com" required />
                      </label>
                      <SubmitButton className="ordersSecondaryButton" pendingText="Enviando teste...">
                        Enviar teste agora
                      </SubmitButton>
                    </form>
                  </div>
                </section>

                <section className="ordersFilterPanel" id="importar-lista">
                  <div className="ordersFilterHeader">
                    <span>2</span>
                    <div>
                      <h2>Importar lista externa</h2>
                      <p>CSV com ponto e vírgula, UTF-8 ou Latin-1, ou texto colado do Excel/Google Sheets.</p>
                    </div>
                  </div>
                  <form action={importMarketingEmailContactsAction} className="emailCampaignImportGrid">
                    <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                    <label className="field">
                      <span>Arquivo CSV</span>
                      <input name="contactListFile" type="file" accept=".csv,.txt,text/csv,text/plain" />
                    </label>
                    <label className="field emailCampaignPasteField">
                      <span>Ou cole a lista</span>
                      <textarea
                        name="contactListText"
                        rows={7}
                        placeholder={`Nome completo;E-mail;Telefone\nAdriana Oliveira da Silva;Drycapereira18@yahoo.com.br;+55 (11) 96207-6614`}
                      />
                    </label>
                    <div className="emailCampaignActions emailCampaignImportActions">
                      <SubmitButton className="ordersPrimaryButton" pendingText="Importando lista...">
                        Importar e validar lista
                      </SubmitButton>
                    </div>
                  </form>
                  {selectedCampaign.importedAt ? (
                    <div className="emailCampaignImportSummary">
                      <article>
                        <span>Reconhecidos</span>
                        <strong>{selectedCampaign.importRecognized}</strong>
                      </article>
                      <article>
                        <span>Ignorados</span>
                        <strong>{selectedCampaign.importIgnored}</strong>
                      </article>
                      <article>
                        <span>Inválidos</span>
                        <strong>{selectedCampaign.importInvalidEmails}</strong>
                      </article>
                      <article>
                        <span>Duplicados</span>
                        <strong>{selectedCampaign.importDuplicates}</strong>
                      </article>
                    </div>
                  ) : null}
                </section>

                <section className="ordersFilterPanel" id="envio">
                  <div className="ordersFilterHeader">
                    <span>3</span>
                    <div>
                      <h2>Enviar campanha</h2>
                      <p>O envio usa somente os contatos importados nesta campanha externa.</p>
                    </div>
                  </div>
                  <form action={sendMarketingEmailCampaignAction} className="emailCampaignSendBox">
                    <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                    <div>
                      <strong>{selectedCampaign.metrics.recipients} contato(s) importado(s)</strong>
                      <p>
                        Pendentes: {selectedCampaign.metrics.pending} · Enviados: {selectedCampaign.metrics.sent} · Falhas: {selectedCampaign.metrics.failed}
                      </p>
                      {!selectedCampaignCanSend ? (
                        <p className="emailCampaignSendWarning">
                          {!selectedCampaignHasContent
                            ? "Salve assunto, mensagem e link de destino antes de enviar."
                            : "Importe uma lista com e-mails válidos antes de enviar."}
                        </p>
                      ) : null}
                    </div>
                    {selectedCampaignCanSend ? (
                      <SubmitButton className="ordersPrimaryButton" pendingText="Enviando campanha...">
                        Enviar campanha
                      </SubmitButton>
                    ) : (
                      <button className="ordersPrimaryButton" disabled type="button">
                        Enviar campanha
                      </button>
                    )}
                  </form>
                </section>

                <section className="ordersTablePanel">
                  <div className="ordersTableHeader">
                    <div>
                      <h2>Contatos da campanha</h2>
                      <p>Prévia dos primeiros contatos importados.</p>
                    </div>
                  </div>
                  {selectedCampaign.recipients.length === 0 ? (
                    <div className="ordersEmptyState">Nenhum contato importado ainda.</div>
                  ) : (
                    <div className="ordersTableWrap">
                      <table className="ordersDeskTable emailCampaignRecipientsTable">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>E-mail</th>
                            <th>Telefone</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCampaign.recipients.map((recipient) => (
                            <tr key={recipient.id}>
                              <td>{recipient.name}</td>
                              <td>{recipient.email}</td>
                              <td>{recipient.phone || "-"}</td>
                              <td>
                                <span className={`ordersStatusBadge ${statusToneClass(recipient.status)}`}>
                                  {recipient.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </section>
      </section>
    </AdminShell>
  );
}
