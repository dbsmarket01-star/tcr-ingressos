import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { updateEventAction } from "@/features/events/event.actions";
import { eventMapLayoutToFormValue } from "@/features/events/event-map";
import { getEventForManagement } from "@/features/events/event.service";
import { formatDateTimeInput } from "@/lib/format";

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
      <HiddenInput name="eventMapImageUrl" value={event.eventMapImageUrl} />
      <HiddenInput name="eventMapCrop" value={event.eventMapCrop} />
      <HiddenInput name="eventMapTemplate" value={event.eventMapTemplate} />
      <HiddenInput name="eventMapNotes" value={event.eventMapNotes} />
      <HiddenInput name="eventMapLayout" value={eventMapLayoutToFormValue(event.eventMapLayout)} />
      <HiddenInput name="seoTitle" value={event.seoTitle} />
      <HiddenInput name="seoDescription" value={event.seoDescription} />
      <HiddenInput name="seoKeywords" value={event.seoKeywords} />
      <HiddenInput name="seoImageUrl" value={event.seoImageUrl} />
    </>
  );
}

export default async function EditEventPage({ params, searchParams }: EditEventPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const query = searchParams ? await searchParams : {};
  await requireEventAccess(eventId);
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const event = await getEventForManagement(eventId, admin.organizationId!, allowedEventIds);
  const error = typeof query.error === "string" ? query.error : null;

  if (!event) {
    notFound();
  }

  const hasPixel = Boolean(event.metaPixelId);
  const hasGtm = Boolean(event.googleTagManagerId);
  const hasMetaCapi = Boolean(event.metaPixelId && event.metaConversionsApiToken);

  const mediaReadiness = [
    {
      label: "Banner",
      status: Boolean(event.bannerUrl),
      description: event.bannerUrl ? "Configurado" : "Pendente para conversão"
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
            <p className="muted">Configurações essenciais, venda e tracking em blocos mais claros.</p>
          </div>
          <div className="formFlowBar" aria-label="Etapas do evento">
            <span className="isCurrent">Resumo</span>
            <span>Dados</span>
            <span>Data e local</span>
            <span>Venda</span>
            <span>Tracking</span>
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
