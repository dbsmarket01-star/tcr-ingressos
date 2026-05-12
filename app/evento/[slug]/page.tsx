import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { WhatsappFloatingButton } from "@/components/public/WhatsappFloatingButton";
import { getCachedEventSeoBySlugInOrganization, getCachedPublicEventBySlugInOrganization } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { calculateServiceFeeInCents } from "@/features/pricing/pricing";
import { buildEventSeo } from "@/features/seo/event-seo";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { imageCropFromBannerPosition, imageCropStyle, parseImageCrop } from "@/lib/image-crop";
import { TrackingRuntime } from "./TrackingRuntime";
import { CheckoutEstimator } from "./CheckoutEstimator";
import { TicketQuantityStepper } from "./TicketQuantityStepper";
import { AddToCartButton } from "./AddToCartButton";
import { FeeExplanationButton } from "./FeeExplanationButton";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<EventPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const event = await getCachedEventSeoBySlugInOrganization(slug, organizationContext.organization.id);

  if (!event) {
    return {
      title: `Evento não encontrado | ${organizationContext.brandName}`
    };
  }

  const seo = buildEventSeo(event);

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: seo.canonicalPath
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
      images: seo.image ? [{ url: seo.image }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: seo.image ? [seo.image] : undefined
    }
  };
}

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const [event, companySettings] = await Promise.all([
    getCachedPublicEventBySlugInOrganization(slug, organizationContext.organization.id),
    getCompanySettingsByOrganizationId(organizationContext.organization.id)
  ]);

  if (!event) {
    notFound();
  }

  const now = new Date();
  const activeLots = event.lots.filter((lot) => {
    const startsOk = !lot.salesStartsAt || lot.salesStartsAt <= now;
    const endsOk = !lot.salesEndsAt || lot.salesEndsAt >= now;
    const hasStock = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity > 0;
    return startsOk && endsOk && hasStock;
  });

  const checkoutError = typeof query.checkoutError === "string" ? query.checkoutError : null;
  const tracking = getTrackingParamsFromSearch(query, `/evento/${event.slug}`);
  const heroImage =
    event.bannerUrl ||
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80";
  const bannerCrop = parseImageCrop(event.bannerCrop) || imageCropFromBannerPosition(event.bannerPosition);
  const publicBannerCrop = bannerCrop;
  const mapCrop = parseImageCrop(event.eventMapCrop);
  const ctaText = event.conversionCtaText || "Garantir minha vaga";
  const highlightedLotId = event.highlightedLotId || activeLots[0]?.id;
  const eventLead = event.subtitle?.trim() || "";
  const lowestTotalInCents = activeLots.reduce((lowest, lot) => {
    const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps);
    const total = lot.priceInCents + serviceFeeInCents;
    return lowest === 0 || total < lowest ? total : lowest;
  }, 0);
  const hasServiceFees = activeLots.some(
    (lot) => calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps) > 0
  );
  const checkoutEstimatorLots = activeLots.map((lot) => ({
    id: lot.id,
    name: lot.name,
    totalWithFeeInCents: lot.priceInCents + calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps)
  }));
  const publicSocialSettings = companySettings as typeof companySettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
  };

  return (
    <main className="shell">
      {event.googleTagManagerId ? (
        <>
          <Script id="public-gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer',${JSON.stringify(event.googleTagManagerId)});
            `}
          </Script>
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={`https://www.googletagmanager.com/ns.html?id=${event.googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      ) : null}
      {event.metaPixelId ? (
        <Script id="public-meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(event.metaPixelId)});
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
      <TrackingRuntime
        eventId={event.id}
        eventTitle={event.title}
        eventSlug={event.slug}
        metaPixelId={event.metaPixelId}
        googleTagManagerId={event.googleTagManagerId}
        tracking={tracking}
      />
      <header className="topbar">
        <Link className="brand" href="/">
          {organizationContext.brandLogoUrl ? (
            <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
          ) : (
            <span className="brandMark">{organizationContext.brandMark}</span>
          )}
          {!organizationContext.brandLogoUrl ? <span>{organizationContext.brandName}</span> : null}
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href="/">Eventos</Link>
        </nav>
      </header>

      <section className="publicHero">
        <div className={`publicHeroMedia ${publicBannerCrop ? "hasCrop" : ""}`}>
          <img
            className={`publicHeroImage ${publicBannerCrop ? "croppedImage" : ""}`}
            src={heroImage}
            alt={`Banner do evento ${event.title}`}
            decoding="async"
            fetchPriority="high"
            height={828}
            loading="eager"
            style={imageCropStyle(publicBannerCrop)}
            width={1900}
          />
        </div>
        <div className="publicHeroInner">
          <h1>{event.title}</h1>
          {eventLead ? <p className="eventLead">{eventLead}</p> : null}
          <div className="publicMobileFacts" aria-label="Informações principais do evento">
            <div>
              <span>Data e horário</span>
              <strong>{formatDateTime(event.startsAt)}</strong>
            </div>
            <div>
              <span>Localização</span>
              <strong>{event.venueName}</strong>
              <small>
                {event.city}, {event.state}
              </small>
            </div>
          </div>
          <div className="heroActions">
            <a className="button" href="#ingressos">
              {ctaText}
            </a>
          </div>
        </div>
      </section>

      <section className="container publicGrid">
        <article className="publicContent">
          {event.description?.trim() ? (
          <section className="editorialBlock eventDescriptionBlock">
            <span className="eyebrow">Experiência do evento</span>
            <h2>Descrição do evento</h2>
            <p>{event.description}</p>
          </section>
        ) : null}

          {event.importantInfo ? (
            <section className="contentBlock eventImportantInfoBlock">
              <h2>Informações importantes</h2>
              <p>{event.importantInfo}</p>
            </section>
          ) : null}

          {event.eventMapImageUrl ? (
            <section className="contentBlock eventMapBlock">
              <h2>Mapa do evento</h2>
              <div className={`eventMapImageFrame ${mapCrop ? "hasCrop" : ""}`}>
                <img
                  className={mapCrop ? "croppedImage" : ""}
                  src={event.eventMapImageUrl}
                  alt={`Mapa do evento - ${event.title}`}
                  decoding="async"
                  loading="lazy"
                  style={imageCropStyle(mapCrop)}
                />
              </div>
              {event.eventMapNotes ? <p className="mapNotes">{event.eventMapNotes}</p> : null}
            </section>
          ) : null}
        </article>

        <aside className="purchasePanel" id="ingressos">
          <div className="purchaseStickyLabel">
            <span>Ingressos disponíveis</span>
            <strong>Selecione seus ingressos</strong>
          </div>

          {activeLots.length === 0 ? (
            <div className="empty">Nenhum ingresso disponível no momento.</div>
          ) : (
            <form action={`/evento/${event.slug}/checkout`} className="form" method="get">
              {checkoutError ? <div className="errorBox">{checkoutError}</div> : null}
              <input type="hidden" name="utm_source" value={tracking.utmSource ?? ""} />
              <input type="hidden" name="utm_medium" value={tracking.utmMedium ?? ""} />
              <input type="hidden" name="utm_campaign" value={tracking.utmCampaign ?? ""} />
              <input type="hidden" name="utm_content" value={tracking.utmContent ?? ""} />
              <input type="hidden" name="utm_term" value={tracking.utmTerm ?? ""} />
              <input type="hidden" name="ref" value={tracking.referrer ?? ""} />
              <input type="hidden" name="landingPage" value={tracking.landingPage ?? ""} />
              {typeof query.fbclid === "string" ? <input type="hidden" name="fbclid" value={query.fbclid} /> : null}
              <div className="ticketPickerList">
                {activeLots.map((lot) => {
                  const available = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity;
                  const isLowStock = available <= 25;
                  const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps);
                  const lotEndsSoon = lot.salesEndsAt
                    ? lot.salesEndsAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000
                    : false;
                  const isHighlighted = lot.id === highlightedLotId;
                  const maxQuantity = Math.max(0, Math.min(lot.maxPerOrder, available));

                  return (
                    <article className={`ticketPickerCard ${isHighlighted ? "recommendedLot" : ""}`} key={lot.id}>
                      <input type="hidden" name="lotId" value={lot.id} />
                      <div className="ticketPickerInfo">
                        <strong className="ticketPickerTitle">{lot.name}</strong>
                        <p className="ticketPickerPrice">
                          {formatCurrency(lot.priceInCents)}
                          {serviceFeeInCents > 0 ? <span> (+{formatCurrency(serviceFeeInCents)} taxa)</span> : null}
                        </p>
                        {lot.description ? <small>{lot.description}</small> : null}
                        {isLowStock || lotEndsSoon ? (
                          <small className="ticketPickerUrgency">
                            {isLowStock ? `Últimos ${available} ingressos` : "Lote vira em breve"}
                          </small>
                        ) : null}
                      </div>
                      <TicketQuantityStepper
                        label={lot.name}
                        max={maxQuantity}
                        name={`quantity_${lot.id}`}
                      />
                    </article>
                  );
                })}
              </div>

              <CheckoutEstimator lots={checkoutEstimatorLots} />

              <AddToCartButton />
              <p className="checkoutFootnote">
                Você informará seus dados e concluirá o pedido na próxima etapa.
              </p>
              {hasServiceFees ? <FeeExplanationButton /> : null}
            </form>
          )}
        </aside>
      </section>
      {activeLots.length > 0 ? (
        <a className="mobileCheckoutBar" href="#ingressos">
          <span>
            {activeLots.length} opções
            {lowestTotalInCents > 0 ? ` • desde ${formatCurrency(lowestTotalInCents)}` : ""}
          </span>
          <strong>Escolher ingressos</strong>
        </a>
      ) : null}
      <PublicSiteFooter brandName={organizationContext.brandName} settings={publicSocialSettings} />
      {event.supportWhatsappUrl ? <WhatsappFloatingButton href={event.supportWhatsappUrl} /> : null}
    </main>
  );
}
