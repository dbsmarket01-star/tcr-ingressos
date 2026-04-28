import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { updateEventAction } from "@/features/events/event.actions";
import { getEventForManagement } from "@/features/events/event.service";
import { buildEventSeo } from "@/features/seo/event-seo";
import { formatDateTimeInput } from "@/lib/format";
import { getPublicLeadCaptureUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type EditEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EditEventPage({ params }: EditEventPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  await requireEventAccess(eventId);
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    notFound();
  }

  const seo = buildEventSeo(event);
  const mediaReadiness = [
    {
      label: "Banner",
      status: Boolean(event.bannerUrl),
      description: event.bannerUrl ? "Configurado" : "Pendente para conversão"
    },
    {
      label: "Mapa",
      status: Boolean(event.eventMapImageUrl) || event.eventMapTemplate !== "AUTO" || event.lots.length > 0,
      description: event.eventMapImageUrl
        ? "Imagem própria"
        : event.eventMapTemplate !== "AUTO"
          ? "Modelo visual escolhido"
          : event.lots.length > 0
            ? "Automático pelos lotes"
            : "Pendente"
    },
    {
      label: "Imagem SEO",
      status: Boolean(event.seoImageUrl || event.bannerUrl),
      description: event.seoImageUrl ? "Personalizada" : event.bannerUrl ? "Usando banner" : "Pendente"
    },
    {
      label: "Tracking",
      status: Boolean(event.metaPixelId || event.googleTagManagerId),
      description: event.metaPixelId || event.googleTagManagerId ? "Configurado" : "Sem Pixel/GTM"
    }
  ];

  return (
    <AdminShell
      title="Editar evento"
      description="Atualize primeiro o essencial do evento e deixe os blocos avançados recolhidos."
    >
      <form action={updateEventAction} className="card form wideForm">
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="currentBannerUrl" value={event.bannerUrl ?? ""} />
        <input type="hidden" name="currentEventMapImageUrl" value={event.eventMapImageUrl ?? ""} />
        <input type="hidden" name="currentLeadCaptureHeroImageUrl" value={event.leadCaptureHeroImageUrl ?? ""} />

        <section className="adminPanelHero compact">
          <div>
            <span className="sectionEyebrow">Operação do evento</span>
            <h2>Edite com uma visão mais limpa do todo</h2>
            <p className="muted">Reorganizamos os blocos para você revisar publicação, comercial, captação e mapa com menos poluição visual.</p>
          </div>
          <div className="formFlowBar" aria-label="Etapas do evento">
            <span className="isCurrent">Resumo</span>
            <span>Identidade</span>
            <span>Agenda</span>
            <span>Comercial</span>
            <span>Captação</span>
            <span>Mapa</span>
          </div>
        </section>

        <div className="formSection formSectionTone toneSummary">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Estado atual</span>
              <h2>Resumo de publicação</h2>
            </div>
            <p className="muted">Antes de mexer nos detalhes, veja rapidamente o que já está pronto e o que ainda pede atenção.</p>
          </div>
          <div className="mediaReadinessGrid">
            {mediaReadiness.map((item) => (
              <div className={item.status ? "isReady" : "isBlocked"} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.status ? "Ok" : "Atenção"}</strong>
                <small>{item.description}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="formSection formSectionTone tonePrimary">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Identidade do evento</span>
              <h2>Dados principais</h2>
            </div>
            <p className="muted">Nome, descrição e imagens que sustentam a página pública e os compartilhamentos.</p>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Nome do evento</span>
              <input name="title" defaultValue={event.title} required />
            </label>
            <label className="field">
              <span>Slug público</span>
              <input name="slug" defaultValue={event.slug} required />
            </label>
          </div>
          <label className="field">
            <span>Subtítulo</span>
            <input name="subtitle" defaultValue={event.subtitle ?? ""} />
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea name="description" rows={5} defaultValue={event.description} placeholder="Opcional. Descreva o evento se quiser exibir esse bloco na página pública." />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="bannerFile"
              label="Trocar banner"
              currentImageUrl={event.bannerUrl}
              currentCropValue={event.bannerCrop}
              recommendedSize="Ideal: 1920 x 840 px"
              usageHint="Envie a arte final e use o recorte guiado para pré-visualizar o enquadramento no topo público."
              help="JPG, PNG, WEBP ou GIF ate 10MB para substituir o banner atual."
              emptyText="Sem banner atual"
              aspect="banner"
              cropFieldName="bannerCrop"
            />
          </div>
          <div className="mediaSizingGuide">
            <div>
              <span>Banner topo</span>
              <strong>1920 x 840 px</strong>
              <p>Use arte horizontal. O recorte guiado te mostra antes de salvar o que vai aparecer no desktop e no mobile.</p>
            </div>
            <div>
              <span>Recorte guiado</span>
              <strong>Mais seguro</strong>
              <p>Você envia a arte, ajusta o enquadramento com a prévia e salva sem depender daquele seletor antigo confuso.</p>
            </div>
          </div>
        </div>

        <div className="formSection formSectionTone toneSchedule">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Agenda e localização</span>
              <h2>Data e local</h2>
            </div>
            <p className="muted">Centralize aqui a agenda e o ponto físico do evento para reduzir retrabalho e dúvida operacional.</p>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início do evento</span>
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.startsAt)}
                required
              />
            </label>
            <label className="field">
              <span>Fim do evento</span>
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.endsAt)}
              />
            </label>
          </div>
          <label className="field">
            <span>Nome do local</span>
            <input name="venueName" defaultValue={event.venueName} required />
          </label>
          <label className="field">
            <span>Endereço</span>
            <input name="venueAddress" defaultValue={event.venueAddress} required />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Cidade</span>
              <input name="city" defaultValue={event.city} required />
            </label>
            <label className="field">
              <span>UF</span>
              <input name="state" maxLength={2} defaultValue={event.state} required />
            </label>
          </div>
        </div>

        <div className="formSection formSectionTone toneSales">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Comercial e rastreamento</span>
              <h2>Venda e tracking</h2>
            </div>
            <p className="muted">Janela de venda, suporte e publicação. Tracking fica recolhido para não embaralhar a operação principal.</p>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início das vendas</span>
              <input
                name="salesStartsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.salesStartsAt)}
              />
            </label>
            <label className="field">
              <span>Fim das vendas</span>
              <input
                name="salesEndsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.salesEndsAt)}
              />
            </label>
          </div>
          <label className="field">
            <span>Informações importantes</span>
            <textarea name="importantInfo" rows={4} defaultValue={event.importantInfo ?? ""} />
          </label>
          <label className="field">
            <span>WhatsApp de suporte</span>
            <input
              name="supportWhatsappUrl"
              defaultValue={event.supportWhatsappUrl ?? ""}
              placeholder="https://wa.me/55DDDNUMERO?text=..."
            />
            <small>Opcional. Esse link aparece como botão flutuante na página do evento e no pedido pendente.</small>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              name="status"
              defaultValue={event.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
            >
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
          </label>
          <details className="advancedSection adminInlineDetails">
            <summary className="formSectionSummary">
              <div>
                <span className="sectionEyebrow">Opcional</span>
                <h2>Tracking e campanhas</h2>
                <p className="muted">Abra este bloco quando o evento já estiver pronto para tráfego.</p>
              </div>
            </summary>
            <div className="grid twoColumns">
              <label className="field">
                <span>Meta Pixel ID</span>
                <input
                  name="metaPixelId"
                  inputMode="numeric"
                  defaultValue={event.metaPixelId ?? ""}
                  placeholder="Ex: 123456789012345"
                />
                <small>Somente números.</small>
              </label>
              <label className="field">
                <span>Google Tag Manager ID</span>
                <input
                  name="googleTagManagerId"
                  defaultValue={event.googleTagManagerId ?? ""}
                  placeholder="Ex: GTM-ABC1234"
                />
                <small>Formato esperado: GTM-XXXXXXX.</small>
              </label>
            </div>
            <div className="trackingGuideGrid">
              <div>
                <span>Página do evento</span>
                <strong>view_event / ViewContent</strong>
                <small>Dispara quando o cliente abre a página pública do evento.</small>
              </div>
              <div>
                <span>Pedido criado</span>
                <strong>order_created / InitiateCheckout</strong>
                <small>Dispara quando o cliente cria o pedido e chega ao pagamento.</small>
              </div>
              <div>
                <span>Compra aprovada</span>
                <strong>purchase / Purchase</strong>
                <small>Dispara quando o pedido está pago e com valor em BRL.</small>
              </div>
            </div>
          </details>
        </div>

        <details className="formSection advancedSection formSectionTone toneLead">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Pré-lançamento</span>
              <h2>Captação de leads</h2>
              <p className="muted">Landing separada da venda para captar interesse, salvar o lead e levar para o grupo de WhatsApp.</p>
            </div>
          </summary>
          <label className="field checkboxField">
            <input name="leadCaptureEnabled" type="checkbox" defaultChecked={event.leadCaptureEnabled} />
            <span>Ativar página de captação para este evento</span>
          </label>
          <div className="infoBox">
            Link público da captação:{" "}
            <Link href={getPublicLeadCaptureUrl(event.slug)} target="_blank">
              /lista/{event.slug}
            </Link>
          </div>
          <label className="field">
            <span>Título da captação</span>
            <input name="leadCaptureHeadline" defaultValue={event.leadCaptureHeadline ?? ""} />
          </label>
          <label className="field">
            <span>Descrição da captação</span>
            <textarea name="leadCaptureDescription" rows={4} defaultValue={event.leadCaptureDescription ?? ""} />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Oferta / incentivo</span>
              <input
                name="leadCaptureOfferText"
                defaultValue={event.leadCaptureOfferText ?? ""}
                placeholder="Ex: Cadastre-se e receba até 20% de desconto na abertura."
              />
            </label>
            <label className="field">
              <span>Texto do botão</span>
              <input name="leadCaptureCtaText" defaultValue={event.leadCaptureCtaText ?? ""} />
            </label>
          </div>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="leadCaptureHeroFile"
              label="Imagem da captação"
              currentImageUrl={event.leadCaptureHeroImageUrl ?? undefined}
              currentCropValue={event.leadCaptureHeroCrop}
              recommendedSize="Ideal: 1600 x 900 px"
              usageHint="Essa imagem aparece só na landing de captação. Use o recorte guiado para deixar a arte bem encaixada."
              help="Use JPG, PNG, WEBP ou GIF até 10MB."
              emptyText="Sem imagem da captação"
              aspect="banner"
              cropFieldName="leadCaptureHeroCrop"
            />
          </div>
          <label className="field">
            <span>Imagens do local (uma URL por linha)</span>
            <textarea
              name="leadCaptureVenueGallery"
              rows={4}
              defaultValue={event.leadCaptureVenueGallery ?? ""}
              placeholder={"https://...\nhttps://...\nhttps://..."}
            />
            <small>Opcional. Use uma URL por linha para exibir a estrutura e o ambiente do local na landing.</small>
          </label>
          <label className="field">
            <span>Vídeo do YouTube</span>
            <input
              name="leadCaptureVideoUrl"
              defaultValue={event.leadCaptureVideoUrl ?? ""}
              placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
            />
            <small>Opcional. Se você informar um vídeo, ele aparece abaixo do topo da landing.</small>
          </label>
          <label className="field">
            <span>Link do grupo de WhatsApp</span>
            <input
              name="leadCaptureWhatsappGroupUrl"
              defaultValue={event.leadCaptureWhatsappGroupUrl ?? ""}
              placeholder="https://chat.whatsapp.com/..."
            />
            <small>Esse botão aparece na página de obrigado, como último passo depois do cadastro.</small>
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Título do agradecimento</span>
              <input
                name="leadCaptureThankYouTitle"
                defaultValue={event.leadCaptureThankYouTitle ?? ""}
                placeholder="Ex: Seu cadastro foi concluído"
              />
            </label>
            <label className="field">
              <span>Texto do botão final</span>
              <input
                name="leadCaptureThankYouButtonText"
                defaultValue={event.leadCaptureThankYouButtonText ?? ""}
                placeholder="Ex: Quero entrar no grupo do WhatsApp"
              />
            </label>
          </div>
          <label className="field">
            <span>Descrição do agradecimento</span>
            <textarea
              name="leadCaptureThankYouDescription"
              rows={3}
              defaultValue={event.leadCaptureThankYouDescription ?? ""}
              placeholder="Ex: Último passo: entre no grupo oficial para receber um desconto de até 30% e acompanhar as informações deste lançamento."
            />
          </label>
        </details>

        <details className="formSection advancedSection formSectionTone toneMap">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Opcional</span>
              <h2>Mapa e setores</h2>
              <p className="muted">Abra apenas se este evento realmente precisar de mapa visual.</p>
            </div>
          </summary>
          <div className="formSectionHeader">
            <div />
            <p className="muted">Deixe o mapa e os setores mais fáceis de entender antes de abrir a venda para o público.</p>
          </div>
          <p className="muted">
            Escolha um modelo de setores, envie uma imagem própria ou use os lotes como setores. Não há cadeira numerada nesta etapa.
          </p>
          <label className="field">
              <span>Modelo do mapa</span>
              <select name="eventMapTemplate" defaultValue={event.eventMapTemplate}>
              <option value="AUTO">Automático pelos lotes</option>
              <option value="AUDITORIUM">Auditório</option>
              <option value="THEATER">Teatro</option>
              <option value="WAREHOUSE">Galpão / arena</option>
              <option value="CLUB">Clube / pista</option>
              <option value="FREE">Livre por setores</option>
            </select>
            <small>O modelo aparece na página pública quando não houver imagem de mapa enviada.</small>
          </label>
          <label className="field">
            <span>Observações do mapa</span>
            <textarea
              name="eventMapNotes"
              maxLength={500}
              rows={3}
              defaultValue={event.eventMapNotes ?? ""}
              placeholder="Ex: Setor ouro próximo ao palco, prata ao fundo, camarote na lateral."
            />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="eventMapFile"
              label="Trocar imagem do mapa"
              currentImageUrl={event.eventMapImageUrl}
              currentCropValue={event.eventMapCrop}
              recommendedSize="Ideal: 1200 x 900 px"
              usageHint="Use o recorte guiado para enquadrar o mapa do jeito que ele deve aparecer para o cliente final."
              help="Use JPG, PNG, WEBP ou GIF até 10MB."
              emptyText="Sem mapa atual"
              aspect="map"
              cropFieldName="eventMapCrop"
            />
          </div>
          <div className="mediaSizingGuide">
            <div>
              <span>Mapa de setores</span>
              <strong>1200 x 900 px</strong>
              <p>Use proporção 4:3 para auditórios, teatros, galpões e clubes.</p>
            </div>
            <div>
              <span>Exibição pública</span>
              <strong>Com prévia guiada</strong>
              <p>Agora você consegue simular o enquadramento final antes de salvar, em vez de descobrir o problema só na página pública.</p>
            </div>
          </div>
        </details>

        <details className="formSection advancedSection formSectionTone toneConversion">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Opcional</span>
              <h2>Textos de conversão</h2>
              <p className="muted">Use este bloco só se quiser dar um tom mais comercial à página pública.</p>
            </div>
          </summary>
          <p className="muted">
            Controle textos comerciais da página pública. Campos vazios usam automaticamente vendas, estoque e dados do evento.
          </p>
          <label className="field">
            <span>Prova social</span>
            <input
              name="conversionSocialProofText"
              maxLength={120}
              defaultValue={event.conversionSocialProofText ?? ""}
              placeholder="+1.237 pessoas já garantiram ingresso"
            />
          </label>
          <label className="field">
            <span>Texto de urgência</span>
            <input
              name="conversionUrgencyText"
              maxLength={140}
              defaultValue={event.conversionUrgencyText ?? ""}
              placeholder="Lote promocional vira hoje às 23:59"
            />
          </label>
          <label className="field">
            <span>Texto do botão principal</span>
            <input
              name="conversionCtaText"
              maxLength={60}
              defaultValue={event.conversionCtaText ?? ""}
              placeholder="Garantir minha vaga agora"
            />
          </label>
          <label className="field">
            <span>Lote em destaque</span>
            <select name="highlightedLotId" defaultValue={event.highlightedLotId ?? ""}>
              <option value="">Automático: primeiro lote disponível</option>
              {event.lots.map((lot) => (
                <option value={lot.id} key={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
            <small>O lote destacado aparece com selo "Mais escolhido" e já vem com quantidade 1 selecionada.</small>
          </label>
        </details>

        <details className="formSection seoPreview advancedSection">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Opcional</span>
              <h2>SEO do evento</h2>
              <p className="muted">Se você não preencher nada aqui, o sistema já monta o básico sozinho.</p>
            </div>
          </summary>
          <label className="field">
            <span>Título SEO</span>
            <input
              name="seoTitle"
              maxLength={70}
              defaultValue={event.seoTitle ?? ""}
              placeholder={seo.title}
            />
            <small>Recomendado: até 60 caracteres. Máximo permitido: 70.</small>
          </label>
          <label className="field">
            <span>Descrição SEO</span>
            <textarea
              name="seoDescription"
              maxLength={180}
              rows={3}
              defaultValue={event.seoDescription ?? ""}
              placeholder={seo.description}
            />
            <small>Recomendado: até 155 caracteres. Máximo permitido: 180.</small>
          </label>
          <label className="field">
            <span>Palavras-chave</span>
            <input
              name="seoKeywords"
              maxLength={300}
              defaultValue={event.seoKeywords ?? ""}
              placeholder="fernandinho, ingressos, salvador"
            />
            <small>Separe por vírgula.</small>
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="seoImageFile"
              label="Trocar imagem SEO / compartilhamento"
              currentImageUrl={event.seoImageUrl || event.bannerUrl}
              recommendedSize="Ideal: 1200 x 630 px"
              usageHint="Essa imagem aparece quando alguem compartilha a pagina do evento."
              help="Opcional. Use uma imagem horizontal para WhatsApp, Google e redes sociais."
              emptyText="Usar banner do evento"
              aspect="share"
            />
            <label className="field mediaUrlFallback">
              <span>URL da imagem SEO</span>
              <input name="seoImageUrl" defaultValue={event.seoImageUrl ?? ""} placeholder={event.bannerUrl ?? "https://..."} />
              <small>Se ficar em branco, usa o banner do evento.</small>
            </label>
          </div>
          <div className="seoPreviewBox">
            <span>{seo.canonicalPath}</span>
            <strong>{seo.title}</strong>
            <p>{seo.description}</p>
          </div>
        </details>

        <div className="formActions">
          <Link className="secondaryButton" href={`/admin/events/${event.id}`}>
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar alterações
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
