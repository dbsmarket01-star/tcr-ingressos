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
import { formatDateTimeInput } from "@/lib/format";

export const dynamic = "force-dynamic";

type EventMapPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ManagedEvent = NonNullable<Awaited<ReturnType<typeof getEventForManagement>>>;

function HiddenInput({ name, value }: { name: string; value?: string | null }) {
  return <input type="hidden" name={name} value={value ?? ""} />;
}

function PreserveEventFields({ event }: { event: ManagedEvent }) {
  return (
    <>
      <HiddenInput name="title" value={event.title} />
      <HiddenInput name="slug" value={event.slug} />
      <HiddenInput name="subtitle" value={event.subtitle} />
      <HiddenInput name="description" value={event.description} />
      <HiddenInput name="doorsOpenAt" value={formatDateTimeInput(event.doorsOpenAt)} />
      <HiddenInput name="startsAt" value={formatDateTimeInput(event.startsAt)} />
      <HiddenInput name="endsAt" value={formatDateTimeInput(event.endsAt)} />
      <HiddenInput name="venueName" value={event.venueName} />
      <HiddenInput name="venueAddress" value={event.venueAddress} />
      <HiddenInput name="googleMapsUrl" value={event.googleMapsUrl} />
      <HiddenInput name="city" value={event.city} />
      <HiddenInput name="state" value={event.state} />
      <HiddenInput name="salesStartsAt" value={formatDateTimeInput(event.salesStartsAt)} />
      <HiddenInput name="salesEndsAt" value={formatDateTimeInput(event.salesEndsAt)} />
      <HiddenInput name="bannerUrl" value={event.bannerUrl} />
      <HiddenInput name="bannerPosition" value={event.bannerPosition} />
      <HiddenInput name="bannerCrop" value={event.bannerCrop} />
      <HiddenInput name="importantInfo" value={event.importantInfo} />
      <HiddenInput name="metaPixelId" value={event.metaPixelId} />
      <HiddenInput name="metaConversionsApiToken" value={event.metaConversionsApiToken} />
      <HiddenInput name="metaTestEventCode" value={event.metaTestEventCode} />
      <HiddenInput name="googleTagManagerId" value={event.googleTagManagerId} />
      <HiddenInput name="seoTitle" value={event.seoTitle} />
      <HiddenInput name="seoDescription" value={event.seoDescription} />
      <HiddenInput name="seoKeywords" value={event.seoKeywords} />
      <HiddenInput name="seoImageUrl" value={event.seoImageUrl} />
      <HiddenInput name="supportWhatsappUrl" value={event.supportWhatsappUrl} />
      <HiddenInput name="couponsEnabled" value={event.couponsEnabled ? "on" : ""} />
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
      <HiddenInput name="conversionSocialProofText" value={event.conversionSocialProofText} />
      <HiddenInput name="conversionUrgencyText" value={event.conversionUrgencyText} />
      <HiddenInput name="conversionCtaText" value={event.conversionCtaText} />
      <HiddenInput name="highlightedLotId" value={event.highlightedLotId} />
      <HiddenInput name="status" value={event.status} />
    </>
  );
}

export default async function EventMapPage({ params, searchParams }: EventMapPageProps) {
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

  return (
    <AdminShell
      title="Mapa convencional"
      description="Monte o mapa visual do evento em blocos modulares ou mantenha uma imagem pronta como fallback."
    >
      <form action={updateEventAction} className="card form wideForm">
        {error ? <ErrorNotice message={error} /> : null}
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="currentBannerUrl" value={event.bannerUrl ?? ""} />
        <input type="hidden" name="currentEventMapImageUrl" value={event.eventMapImageUrl ?? ""} />
        <input type="hidden" name="currentLeadCaptureHeroImageUrl" value={event.leadCaptureHeroImageUrl ?? ""} />
        <input type="hidden" name="redirectTo" value={`/admin/events/${event.id}/map`} />
        <PreserveEventFields event={event} />

        <section className="adminPanelHero compact">
          <div>
            <span className="sectionEyebrow">Mapa do evento</span>
            <h2>Mapa convencional</h2>
            <p className="muted">Essa tela fica separada das configurações principais para editar apenas setores, blocos e imagem do mapa.</p>
          </div>
          <div className="formFlowBar" aria-label="Etapas do mapa">
            <span className="isCurrent">Mapa modular</span>
            <span>Imagem pronta</span>
            <span>Observações</span>
          </div>
        </section>

        <div className="formSection formSectionTone toneMap">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Editor visual</span>
              <h2>Blocos e setores</h2>
            </div>
            <p className="muted">Arraste, redimensione, renomeie e altere as cores dos blocos. O mapa salvo aparece na página pública do evento.</p>
          </div>
          <EventMapEditor
            initialValue={eventMapLayoutToFormValue(event.eventMapLayout)}
            mapSources={mapSources.map((source) => ({
              id: source.id,
              title: source.title,
              layoutValue: eventMapLayoutToFormValue(source.eventMapLayout)
            }))}
          />
        </div>

        <div className="formSection formSectionTone toneSummary">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Fallback</span>
              <h2>Imagem pronta do mapa</h2>
            </div>
            <p className="muted">Use apenas quando já existir uma arte fechada. Se houver mapa modular salvo, ele continua preservado.</p>
          </div>
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
            <small>O modelo aparece na página pública quando não houver imagem enviada nem mapa modular configurado.</small>
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
        </div>

        <div className="formActions">
          <Link className="secondaryButton" href={`/admin/events/${event.id}`}>
            Voltar
          </Link>
          <button className="button" type="submit">
            Salvar mapa
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
