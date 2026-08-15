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
      text: "Assunto, mensagem e chamada foram salvos para esta campanha."
    };
  }

  if (params.created) {
    return {
      tone: "success" as const,
      title: "Campanha criada",
      text: "Agora importe a lista externa e configure o conteúdo do e-mail."
    };
  }

  return null;
}

function formatStatusClass(status: string) {
  if (status === "COMPLETED") return "published";
  if (status === "FAILED" || status === "COMPLETED_WITH_ERRORS") return "danger";
  if (status === "QUEUED" || status === "PROCESSING") return "pending";
  return "draft";
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

  return (
    <AdminShell
      title="Disparos de e-mail"
      description="Crie campanhas externas independentes ou use as listas de leads dos eventos."
    >
      <div className="spacedSection">
        <Link className="secondaryButton smallButton" href="/admin/marketing/email">
          Voltar para opções de e-mail
        </Link>
      </div>

      <section className="operationCommandStrip spacedSection" aria-label="Campanhas externas de e-mail">
        <article className="operationCommandCard">
          <span className="eyebrow">Marketing</span>
          <h2>Campanhas externas da {organizationContext.brandName}.</h2>
          <p>
            Importe uma lista própria, valide os contatos e envie e-mails sem misturar com leads captados nas páginas dos eventos.
          </p>
        </article>
        <form action={createMarketingEmailCampaignAction} className="operationCommandActions">
          <label className="field">
            <span>Nome da campanha</span>
            <input name="name" placeholder="Ex.: Lista fria Claudio Duarte agosto" required minLength={3} />
          </label>
          <SubmitButton className="button smallButton" pendingText="Criando...">
            Criar campanha nova
          </SubmitButton>
        </form>
      </section>

      {message ? (
        <section className={`noticeCard notice-${message.tone} spacedSection`}>
          <strong>{message.title}</strong>
          <p>{message.text}</p>
        </section>
      ) : null}

      <section className="adminTwoColumnGrid">
        <aside className="card adminPanelBlock">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Campanhas externas</h2>
              <p className="muted">Não dependem de evento publicado.</p>
            </div>
          </div>
          {campaigns.length === 0 ? (
            <div className="empty">Nenhuma campanha criada ainda.</div>
          ) : (
            <div className="leadInsightList campaignInsightList">
              {campaigns.map((campaign) => (
                <Link
                  className={`campaignInsightRow ${campaign.id === selectedCampaign?.id ? "is-active" : ""}`}
                  href={`/admin/marketing/email?campaignId=${campaign.id}`}
                  key={campaign.id}
                >
                  <div className="campaignInsightCopy">
                    <div className="campaignInsightTitleRow">
                      <strong>{campaign.name}</strong>
                      <span className={`status ${formatStatusClass(campaign.status)}`}>
                        {getMarketingEmailStatusLabel(campaign.status)}
                      </span>
                    </div>
                    <span>{formatDateTime(campaign.createdAt)}</span>
                  </div>
                  <div className="campaignInsightStats">
                    <span>{campaign.metrics.recipients} contato(s)</span>
                    <span>{campaign.metrics.sent} enviado(s)</span>
                    <span>{campaign.metrics.failed} falha(s)</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <main className="stackForm">
          {!selectedCampaign ? (
            <section className="card adminPanelBlock">
              <div className="empty">Crie uma campanha nova para começar.</div>
            </section>
          ) : (
            <>
              <section className="card adminPanelBlock">
                <div className="sectionHeader inlineHeader">
                  <div>
                    <h2>{selectedCampaign.name}</h2>
                    <p className="muted">
                      Status: {getMarketingEmailStatusLabel(selectedCampaign.status)}
                      {selectedCampaign.importedAt ? ` · Lista importada em ${formatDateTime(selectedCampaign.importedAt)}` : ""}
                    </p>
                  </div>
                  <span className={`status ${formatStatusClass(selectedCampaign.status)}`}>
                    {getMarketingEmailStatusLabel(selectedCampaign.status)}
                  </span>
                </div>
                {selectedCampaign.lastError ? (
                  <div className="noticeCard notice-danger">
                    <strong>Última falha</strong>
                    <p>{selectedCampaign.lastError}</p>
                  </div>
                ) : null}
                <div className="campaignSummaryGrid">
                  <article className="campaignSummaryCard">
                    <span>Pendentes</span>
                    <strong>{selectedCampaign.metrics.pending + selectedCampaign.metrics.processing}</strong>
                  </article>
                  <article className="campaignSummaryCard">
                    <span>Enviados</span>
                    <strong>{selectedCampaign.metrics.sent}</strong>
                  </article>
                  <article className="campaignSummaryCard campaignSummaryCardWarning">
                    <span>Falhas</span>
                    <strong>{selectedCampaign.metrics.failed}</strong>
                  </article>
                  <article className="campaignSummaryCard">
                    <span>Aberturas</span>
                    <strong>{selectedCampaign.metrics.opens}</strong>
                  </article>
                  <article className="campaignSummaryCard">
                    <span>Cliques</span>
                    <strong>{selectedCampaign.metrics.clicks}</strong>
                  </article>
                </div>
              </section>

              <section className="card adminPanelBlock" id="importar-lista">
                <div className="sectionHeader inlineHeader">
                  <div>
                    <h2>1. Importar lista externa</h2>
                    <p className="muted">CSV com ponto e vírgula ou texto colado do Excel/Google Sheets.</p>
                  </div>
                </div>
                <form action={importMarketingEmailContactsAction} className="stackForm">
                  <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                  <label className="field">
                    <span>Arquivo CSV</span>
                    <input name="contactListFile" type="file" accept=".csv,.txt,text/csv,text/plain" />
                  </label>
                  <label className="field">
                    <span>Ou cole a lista</span>
                    <textarea
                      name="contactListText"
                      rows={7}
                      placeholder={`Nome completo;E-mail;Telefone\nAdriana Oliveira da Silva;Drycapereira18@yahoo.com.br;+55 (11) 96207-6614`}
                    />
                  </label>
                  <SubmitButton className="button smallButton" pendingText="Importando lista...">
                    Importar e validar lista
                  </SubmitButton>
                </form>
                {selectedCampaign.importedAt ? (
                  <div className="campaignSummaryGrid">
                    <article className="campaignSummaryCard">
                      <span>Reconhecidos</span>
                      <strong>{selectedCampaign.importRecognized}</strong>
                    </article>
                    <article className="campaignSummaryCard">
                      <span>Ignorados</span>
                      <strong>{selectedCampaign.importIgnored}</strong>
                    </article>
                    <article className="campaignSummaryCard campaignSummaryCardWarning">
                      <span>Inválidos</span>
                      <strong>{selectedCampaign.importInvalidEmails}</strong>
                    </article>
                    <article className="campaignSummaryCard">
                      <span>Duplicados</span>
                      <strong>{selectedCampaign.importDuplicates}</strong>
                    </article>
                  </div>
                ) : null}
              </section>

              <section className="card adminPanelBlock" id="conteudo">
                <div className="sectionHeader inlineHeader">
                  <div>
                    <h2>2. Conteúdo do e-mail</h2>
                    <p className="muted">Assunto, mensagem, botão e link de destino da campanha.</p>
                  </div>
                </div>
                <form action={saveMarketingEmailContentAction} className="stackForm">
                  <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                  <label className="field">
                    <span>Assunto</span>
                    <input name="subject" defaultValue={selectedCampaign.subject ?? ""} placeholder="Ex.: Convite especial para você" required />
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
                  <div className="formGrid twoColumns">
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
                  <SubmitButton className="button smallButton" pendingText="Salvando conteúdo...">
                    Salvar conteúdo
                  </SubmitButton>
                </form>
              </section>

              <section className="card adminPanelBlock" id="envio">
                <div className="sectionHeader inlineHeader">
                  <div>
                    <h2>3. Teste e envio</h2>
                    <p className="muted">Envie um teste antes de disparar para toda a lista importada.</p>
                  </div>
                </div>
                <div className="formGrid twoColumns">
                  <form action={sendMarketingEmailTestAction} className="stackForm">
                    <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                    <label className="field">
                      <span>E-mail de teste</span>
                      <input name="testEmail" type="email" placeholder="voce@empresa.com.br" required />
                    </label>
                    <SubmitButton className="secondaryButton smallButton" pendingText="Enviando teste...">
                      Enviar teste
                    </SubmitButton>
                  </form>
                  <form action={sendMarketingEmailCampaignAction} className="stackForm">
                    <input type="hidden" name="campaignId" value={selectedCampaign.id} />
                    <div className="leadBroadcastFilterCard">
                      <strong>{selectedCampaign.metrics.recipients} contato(s) importado(s)</strong>
                      <p className="muted">O envio usa apenas esta lista externa, sem misturar com leads de eventos.</p>
                    </div>
                    <SubmitButton className="button smallButton" pendingText="Enviando campanha...">
                      Enviar campanha
                    </SubmitButton>
                  </form>
                </div>
              </section>

              <section className="card adminPanelBlock">
                <div className="sectionHeader inlineHeader">
                  <div>
                    <h2>Contatos da campanha</h2>
                    <p className="muted">Prévia dos primeiros contatos importados.</p>
                  </div>
                </div>
                {selectedCampaign.recipients.length === 0 ? (
                  <div className="empty">Nenhum contato importado ainda.</div>
                ) : (
                  <div className="tableScroll wideTableScroll adminTableWrap">
                    <table className="table operationalTable">
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
                              <span className={`status ${recipient.status === "SENT" ? "published" : recipient.status === "FAILED" ? "danger" : "pending"}`}>
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

    </AdminShell>
  );
}
