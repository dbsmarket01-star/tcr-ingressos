import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventMapEditor } from "@/components/admin/EventMapEditor";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { updateEventAction } from "@/features/events/event.actions";
import { eventMapLayoutToFormValue } from "@/features/events/event-map";
import { getEventForManagement, listEventMapSources } from "@/features/events/event.service";
import { buildEventSeo } from "@/features/seo/event-seo";
import { formatDateTimeInput } from "@/lib/format";
import { getPublicLeadCaptureUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type EditEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ManagedEvent = NonNullable<Awaited<ReturnType<typeof getEventForManagement>>>;

function HiddenInput({ name, value }: { name: string; value?: string | null }) {
  return <input type="hidden" name={name} value={value ?? ""} />;
}

function PreserveRemovedEventSettings({ event }: { event: ManagedEvent }) {
  return (
    <>
      <HiddenInput name="leadCaptureEnabled" value={event.leadCaptureEnabled ? "on" : ""} />
      <HiddenInput name="leadCaptureHeadline" value={event.leadCaptureHeadline} />
      <HiddenInput name="leadCaptureDescription" value={event.leadCaptureDescription} />
      <HiddenInput name="leadCaptureOfferText" value={event.leadCaptureOfferText} />
      <HiddenInput name="leadCaptureCtaText" value={event.leadCaptureCtaText} />
      <HiddenInput name="leadCaptureBadgeText" value={event.leadCaptureBadgeText} />
      <HiddenInput name="leadCaptureHeroSupportText" value={event.leadCaptureHeroSupportText} />
      <HiddenInput name="leadCaptureBenefitsText" value={event.leadCaptureBenefitsText} />
      <HiddenInput name="leadCaptureFormIntroEyebrow" value={event.leadCaptureFormIntroEyebrow} />
      <HiddenInput name="leadCaptureFormIntroTitle" value={event.leadCaptureFormIntroTitle} />
      <HiddenInput name="leadCaptureFormIntroDescription" value={event.leadCaptureFormIntroDescription} />
      <HiddenInput name="leadCaptureFormTimingText" value={event.leadCaptureFormTimingText} />
      <HiddenInput name="leadCaptureBonusText" value={event.leadCaptureBonusText} />
      <HiddenInput name="leadCaptureProofText" value={event.leadCaptureProofText} />
      <HiddenInput name="leadCaptureFooterStatsText" value={event.leadCaptureFooterStatsText} />
      <HiddenInput name="leadCaptureHeroImageUrl" value={event.leadCaptureHeroImageUrl} />
      <HiddenInput name="leadCaptureHeroCrop" value={event.leadCaptureHeroCrop} />
      <HiddenInput name="leadCaptureVenueGallery" value={event.leadCaptureVenueGallery} />
      <HiddenInput name="leadCaptureVideoUrl" value={event.leadCaptureVideoUrl} />
      <HiddenInput name="leadCaptureWhatsappGroupUrl" value={event.leadCaptureWhatsappGroupUrl} />
      <HiddenInput name="leadCaptureThankYouTitle" value={event.leadCaptureThankYouTitle} />
      <HiddenInput name="leadCaptureThankYouDescription" value={event.leadCaptureThankYouDescription} />
      <HiddenInput name="leadCaptureThankYouButtonText" value={event.leadCaptureThankYouButtonText} />
      <HiddenInput name="autoLeadCaptureEmailEnabled" value={event.autoLeadCaptureEmailEnabled !== false ? "on" : ""} />
      <HiddenInput name="autoPurchaseApprovedEmailEnabled" value={event.autoPurchaseApprovedEmailEnabled !== false ? "on" : ""} />
      <HiddenInput name="autoPendingPaymentEmailEnabled" value={event.autoPendingPaymentEmailEnabled !== false ? "on" : ""} />
    </>
  );
}

export default async function EditEventPage({ params, searchParams }: EditEventPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const query = searchParams ? await searchParams : {};
  await requireEventAccess(eventId);
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const [event, mapSources] = await Promise.all([
    getEventForManagement(eventId, admin.organizationId!, allowedEventIds),
    listEventMapSources(admin.organizationId!, allowedEventIds, eventId)
  ]);
  const error = typeof query.error === "string" ? query.error : null;

  if (!event) {
    notFound();
  }

  const hasPixel = Boolean(event.metaPixelId);
  const hasGtm = Boolean(event.googleTagManagerId);
  const hasMetaCapi = Boolean(event.metaPixelId && event.metaConversionsApiToken);

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
      status: hasPixel || hasGtm || hasMetaCapi,
      description: hasMetaCapi ? "Pixel + CAPI" : hasPixel || hasGtm ? "Parcial" : "Sem Pixel/GTM/CAPI"
    }
  ];

  return (
    <AdminShell
      title="Editar evento"
      description="Atualize primeiro o essencial do evento e deixe os blocos avançados recolhidos."
    >
      <form action={updateEventAction} className="card form wideForm">
        {error ? <ErrorNotice message={error} /> : null}
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="currentBannerUrl" value={event.bannerUrl ?? ""} />
        <input type="hidden" name="currentEventMapImageUrl" value={event.eventMapImageUrl ?? ""} />
        <input type="hidden" name="currentLeadCaptureHeroImageUrl" value={event.leadCaptureHeroImageUrl ?? ""} />
        <PreserveRemovedEventSettings event={event} />

        <section className="adminPanelHero compact">
          <div>
            <span className="sectionEyebrow">Operação do evento</span>
            <h2>Edite com uma visão mais limpa do todo</h2>
            <p className="muted">Configurações essenciais, venda, mapa convencional, tracking e SEO em blocos mais claros.</p>
          </div>
          <div className="formFlowBar" aria-label="Etapas do evento">
            <span className="isCurrent">Resumo</span>
            <span>Dados</span>
            <span>Data e local</span>
            <span>Venda</span>
            <span>Mapa convencional</span>
            <span>SEO</span>
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
          <label className="field">
            <span>Informações importantes</span>
            <textarea
              name="importantInfo"
              rows={5}
              defaultValue={event.importantInfo ?? ""}
              placeholder="Classificação, duração, regras de entrada, doação solidária e observações essenciais."
            />
            <small>Esse conteúdo aparece na página pública abaixo da descrição do evento.</small>
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="bannerFile"
              label="Trocar banner"
              currentImageUrl={event.bannerUrl}
              currentCropValue={event.bannerCrop}
              recommendedSize="Ideal: 1900 x 828 px"
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
              <strong>1900 x 828 px</strong>
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
              <span>Abertura dos portões</span>
              <input
                name="doorsOpenAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.doorsOpenAt)}
              />
              <small>Opcional. Use quando a entrada abre antes do início.</small>
            </label>
            <label className="field">
              <span>Início do evento</span>
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.startsAt)}
                required
              />
            </label>
          </div>
          <div className="grid twoColumns">
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
          <label className="field">
            <span>Link do Google Maps</span>
            <input name="googleMapsUrl" defaultValue={event.googleMapsUrl ?? ""} placeholder="https://maps.google.com/..." />
            <small>Opcional. Quando preenchido, mostra “Como chegar ao evento” na página pública.</small>
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
              <span className="sectionEyebrow">Comercial</span>
              <h2>Venda e publicação</h2>
            </div>
            <p className="muted">Janela de venda, status público, cupons e suporte ao comprador ficam juntos aqui.</p>
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
            <span>WhatsApp de suporte</span>
            <input
              name="supportWhatsappUrl"
              defaultValue={event.supportWhatsappUrl ?? ""}
              placeholder="https://wa.me/55DDDNUMERO?text=..."
            />
            <small>Opcional. Esse link aparece como botão flutuante na página do evento e no pedido pendente.</small>
          </label>
          <div className="adminToggleNote">
            <label className="field checkboxField">
              <input name="couponsEnabled" type="checkbox" defaultChecked={event.couponsEnabled} />
              <span>Permitir cupom de desconto neste evento</span>
            </label>
            <small>Quando estiver desligado, o campo de cupom não aparece no checkout e códigos não serão aceitos.</small>
          </div>
          <label className="field">
            <span>Status</span>
            <select
              name="status"
              defaultValue={event.status}
            >
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="UNPUBLISHED">Venda pública pausada</option>
            </select>
            <small>
              Use &quot;Venda pública oculta&quot; para tirar <code>/evento/{event.slug}</code> do ar sem desligar a captação em
              <code> /lista/{event.slug}</code>.
            </small>
          </label>
        </div>

        <details className="formSection advancedSection formSectionTone toneSummary">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Comercial e rastreamento</span>
              <h2>Tracking e campanhas</h2>
              <p className="muted">Pixel, CAPI e GTM ficam separados da venda para não confundir a operação.</p>
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
                <span>Token da API de conversão do Meta</span>
                <input
                  name="metaConversionsApiToken"
                  defaultValue={event.metaConversionsApiToken ?? ""}
                  placeholder="Ex: EAA..."
                  type="password"
                />
                <small>Usado para enviar a venda confirmada direto do servidor para o Meta.</small>
              </label>
            </div>
            <div className="grid twoColumns">
              <label className="field">
                <span>Código de teste do Meta</span>
                <input
                  name="metaTestEventCode"
                  defaultValue={event.metaTestEventCode ?? ""}
                  placeholder="Ex: TEST12345"
                />
                <small>Opcional. Preencha só enquanto estiver validando no Events Manager.</small>
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
              <div>
                <span>Venda via servidor</span>
                <strong>Conversions API</strong>
                <small>Quando Pixel ID e token estiverem preenchidos juntos, a venda aprovada sobe também pelo backend.</small>
              </div>
            </div>
        </details>

        <details className="formSection advancedSection formSectionTone toneLead" hidden>
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Pré-lançamento</span>
              <h2>Captação de leads</h2>
              <p className="muted">Landing separada da venda para captar interesse, salvar o lead e levar para o grupo de WhatsApp.</p>
            </div>
          </summary>
          <div className="channelFocusGrid">
            <div className="channelFocusCard leadFocusCard">
              <span className="channelFocusEyebrow">Captação de leads</span>
              <strong>Essa frente cuida da pré-lista, do aquecimento e do grupo oficial antes da abertura.</strong>
              <small>É o bloco certo para campanha de cadastro, comunicação antecipada e direcionamento para o WhatsApp.</small>
            </div>
            <div className="channelFocusChecklist">
              <span className="channelFocusEyebrow">Checklist desta frente</span>
              <ul>
                <li>Landing ativa para o evento</li>
                <li>Oferta e CTA bem definidos</li>
                <li>Grupo de WhatsApp configurado</li>
                <li>Página de obrigado pronta para conversão</li>
              </ul>
            </div>
          </div>
          <label className="field checkboxField">
            <input name="leadCaptureEnabled" type="checkbox" defaultChecked={event.leadCaptureEnabled} />
            <span>Ativar página de captação para este evento</span>
          </label>
          <div className="leadAdminUtilityBar">
            <div className="infoBox">
              Link público da captação:{" "}
              <Link href={getPublicLeadCaptureUrl(event.slug)} target="_blank">
                /lista/{event.slug}
              </Link>
            </div>
            <div className="leadAdminQuickLinks">
              <Link className="secondaryButton" href={getPublicLeadCaptureUrl(event.slug)} target="_blank">
                Ver landing
              </Link>
              <Link className="secondaryButton" href={`${getPublicLeadCaptureUrl(event.slug)}/obrigado`} target="_blank">
                Ver obrigado
              </Link>
              <Link className="secondaryButton" href={`/admin/events/${event.id}/leads`}>
                Ver leads
              </Link>
            </div>
          </div>
          <div className="leadCaptureAdminSections">
            <section className="leadAdminBlock leadAdminBlockMessage">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Oferta e mensagem</span>
                  <h3>O texto que chama o lead para a lista</h3>
                </div>
                <p className="muted">Esses campos definem o que a pessoa lê logo depois do banner e o que ela entende como benefício imediato.</p>
              </div>
              <label className="field">
                <span>Título da captação</span>
                <input name="leadCaptureHeadline" defaultValue={event.leadCaptureHeadline ?? ""} />
              </label>
              <label className="field">
                <span>Descrição da captação</span>
                <textarea name="leadCaptureDescription" rows={4} defaultValue={event.leadCaptureDescription ?? ""} />
                <small>Você pode usar **texto** para destacar partes importantes em negrito na landing.</small>
              </label>
              <div className="grid twoColumns">
                <label className="field">
                  <span>Oferta / incentivo</span>
                  <input
                    name="leadCaptureOfferText"
                    defaultValue={event.leadCaptureOfferText ?? ""}
                    placeholder="Ex: Cadastre-se e receba até 20% de desconto na abertura."
                  />
                  <small>Use uma promessa curta e forte. Também aceita **negrito** com **texto**.</small>
                </label>
                <label className="field">
                  <span>Texto do botão</span>
                  <input name="leadCaptureCtaText" defaultValue={event.leadCaptureCtaText ?? ""} />
                </label>
              </div>
              <div className="grid twoColumns">
                <label className="field">
                  <span>Selo do topo</span>
                  <input
                    name="leadCaptureBadgeText"
                    defaultValue={event.leadCaptureBadgeText ?? ""}
                    placeholder="Ex: Vagas limitadas"
                  />
                </label>
                <label className="field">
                  <span>Texto de apoio do topo</span>
                  <input
                    name="leadCaptureHeroSupportText"
                    defaultValue={event.leadCaptureHeroSupportText ?? ""}
                    placeholder="Ex: Uma noite que pode transformar o seu casamento para sempre."
                  />
                </label>
              </div>
              <label className="field">
                <span>Faixa de benefícios (uma linha por item)</span>
                <textarea
                  name="leadCaptureBenefitsText"
                  rows={4}
                  defaultValue={event.leadCaptureBenefitsText ?? ""}
                  placeholder={"Acesso antecipado|Quem está na lista entra primeiro no grupo oficial.\nDesconto exclusivo|Ganhe até 30% de desconto no lançamento.\nVagas limitadas|Ingressos limitados para garantir a melhor experiência."}
                />
                <small>Use o formato Título|Descrição. Cada linha vira um benefício na faixa de destaque abaixo do banner.</small>
              </label>
              <div className="grid twoColumns">
                <label className="field">
                  <span>Eyebrow do formulário</span>
                  <input
                    name="leadCaptureFormIntroEyebrow"
                    defaultValue={event.leadCaptureFormIntroEyebrow ?? ""}
                    placeholder="Ex: Garanta seu acesso"
                  />
                </label>
                <label className="field">
                  <span>Tempo estimado do formulário</span>
                  <input
                    name="leadCaptureFormTimingText"
                    defaultValue={event.leadCaptureFormTimingText ?? ""}
                    placeholder="Ex: Leva menos de 30 segundos"
                  />
                </label>
              </div>
              <label className="field">
                <span>Título lateral do formulário</span>
                <textarea
                  name="leadCaptureFormIntroTitle"
                  rows={3}
                  defaultValue={event.leadCaptureFormIntroTitle ?? ""}
                  placeholder="Ex: Entre para a lista e garanta seu lugar com desconto exclusivo."
                />
              </label>
              <label className="field">
                <span>Descrição lateral do formulário</span>
                <textarea
                  name="leadCaptureFormIntroDescription"
                  rows={3}
                  defaultValue={event.leadCaptureFormIntroDescription ?? ""}
                  placeholder="Ex: Preencha seus dados e receba o link do grupo oficial na próxima etapa."
                />
              </label>
              <div className="grid twoColumns">
                <label className="field">
                  <span>Bloco de bônus</span>
                  <textarea
                    name="leadCaptureBonusText"
                    rows={3}
                    defaultValue={event.leadCaptureBonusText ?? ""}
                    placeholder="Ex: Bônus exclusivo|Conteúdos e novidades que vão preparar você para essa experiência única."
                  />
                  <small>Use o formato Título|Descrição.</small>
                </label>
                <label className="field">
                  <span>Prova social</span>
                  <textarea
                    name="leadCaptureProofText"
                    rows={3}
                    defaultValue={event.leadCaptureProofText ?? ""}
                    placeholder="Ex: Mais de 100 mil pessoas impactadas"
                  />
                  <small>Use esse texto para a prova social abaixo do bônus.</small>
                </label>
              </div>
              <label className="field">
                <span>Blocos finais (uma linha por item)</span>
                <textarea
                  name="leadCaptureFooterStatsText"
                  rows={4}
                  defaultValue={event.leadCaptureFooterStatsText ?? ""}
                  placeholder={"+ de 100 mil|pessoas impactadas\n10 anos|transformando famílias\nMilhares de casais|fortalecendo seus lares"}
                />
                <small>Use o formato Título|Descrição. Cada linha vira um bloco da faixa final.</small>
              </label>
            </section>

            <section className="leadAdminBlock leadAdminBlockMedia">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Mídia da landing</span>
                  <h3>Banner, vídeo e fotos do local</h3>
                </div>
                <p className="muted">Essa parte segura o enquadramento da página e ajuda a deixar o mobile e o desktop com mais cara de campanha.</p>
              </div>
              <div className="mediaUploadGrid">
                <ImageUploadField
                  name="leadCaptureHeroFile"
                  label="Imagem da captação"
                  currentImageUrl={event.leadCaptureHeroImageUrl ?? undefined}
                  currentCropValue={event.leadCaptureHeroCrop}
                  recommendedSize="Ideal: 1080 x 1350 px"
                  usageHint="Essa imagem aparece na landing de captação em um quadro mais vertical. Use o recorte guiado para deixar rosto e texto bem encaixados."
                  help="Use JPG, PNG, WEBP ou GIF até 10MB."
                  emptyText="Sem imagem da captação"
                  aspect="lead"
                  cropFieldName="leadCaptureHeroCrop"
                />
              </div>
              <label className="field">
                <span>Vídeo de apresentação (YouTube)</span>
                <input
                  name="leadCaptureVideoUrl"
                  defaultValue={event.leadCaptureVideoUrl ?? ""}
                  placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                />
                <small>Opcional. Cole só o link do YouTube e ele aparece no meio da landing, logo depois do cadastro.</small>
              </label>
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
            </section>

            <section className="leadAdminBlock leadAdminBlockConversion">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Conversão final</span>
                  <h3>Obrigado + botão do grupo</h3>
                </div>
                <p className="muted">Esse é o fechamento do funil. Depois do cadastro, o lead precisa seguir para o grupo de forma objetiva.</p>
              </div>
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
                <small>Esse texto aparece após o cadastro. Você também pode destacar trechos com **negrito**.</small>
              </label>
            </section>
          </div>
        </details>

        <details className="formSection advancedSection formSectionTone toneSummary" hidden>
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Comunicação do evento</span>
              <h2>E-mails automáticos e disparos opcionais</h2>
              <p className="muted">Defina o que o sistema envia sozinho e o que a equipe usa manualmente no momento comercial certo.</p>
            </div>
          </summary>
          <div className="communicationAdminGrid">
            <section className="communicationAdminCard">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Automático</span>
                  <h3>O sistema envia sozinho</h3>
                </div>
                <p className="muted">Esses e-mails entram no fluxo natural do evento e podem ser pausados por evento quando você quiser.</p>
              </div>
              <div className="communicationToggleList">
                <label className="field checkboxField">
                  <input name="autoLeadCaptureEmailEnabled" type="checkbox" defaultChecked={event.autoLeadCaptureEmailEnabled !== false} />
                  <span>Lead se cadastrou → enviar e-mail automaticamente</span>
                </label>
                <label className="field checkboxField">
                  <input name="autoPendingPaymentEmailEnabled" type="checkbox" defaultChecked={event.autoPendingPaymentEmailEnabled !== false} />
                  <span>Pedido pendente → enviar e-mail automaticamente</span>
                </label>
                <label className="field checkboxField">
                  <input name="autoPurchaseApprovedEmailEnabled" type="checkbox" defaultChecked={event.autoPurchaseApprovedEmailEnabled !== false} />
                  <span>Compra aprovada → enviar e-mail automaticamente</span>
                </label>
              </div>
            </section>
            <section className="communicationAdminCard">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Opcional</span>
                  <h3>Disparos manuais da operação</h3>
                </div>
                <p className="muted">Use a central de leads quando quiser fazer ações mais comerciais, pontuais ou segmentadas.</p>
              </div>
              <ul className="channelFocusChecklistList">
                <li>Últimas vagas ou virada de lote</li>
                <li>Lembrete do próximo evento</li>
                <li>Mudança importante de horário ou local</li>
                <li>Reativação de base antiga</li>
                <li>Remarketing por município ou período</li>
                <li>Pós-evento e nova pré-lista</li>
              </ul>
              <div className="actionRow">
                <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/leads#lead-broadcast`}>
                  Abrir central de e-mails
                </Link>
              </div>
            </section>
          </div>
        </details>

        <div className="formSection formSectionTone toneMap" id="mapa-convencional">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Mapa do evento</span>
              <h2>Mapa convencional</h2>
            </div>
            <p className="muted">Monte o mapa visual do evento com blocos modulares ou mantenha uma imagem pronta como fallback antes de abrir a venda.</p>
          </div>
          <p className="muted">
            Monte um mapa modular arrastando blocos ou mantenha uma imagem própria como fallback.
          </p>
          <EventMapEditor
            initialValue={eventMapLayoutToFormValue(event.eventMapLayout)}
            mapSources={mapSources.map((source) => ({
              id: source.id,
              title: source.title,
              layoutValue: eventMapLayoutToFormValue(source.eventMapLayout)
            }))}
          />
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
          {event.eventMapImageUrl ? (
            <label className="field checkboxField removeMapImageField">
              <input name="removeEventMapImage" type="checkbox" />
              <span>Excluir imagem antiga do mapa e deixar apenas o mapa modular, se ele estiver configurado</span>
            </label>
          ) : null}
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
        </div>

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
