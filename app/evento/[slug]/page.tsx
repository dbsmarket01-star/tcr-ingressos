import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { SeatMapTicketSelector } from "@/components/public/SeatMapTicketSelector";
import { EventMapView } from "@/components/public/EventMapView";
import { WhatsappFloatingButton } from "@/components/public/WhatsappFloatingButton";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getCachedEventSeoBySlugInOrganization, getCachedPublicEventBySlugInOrganization } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { listPaymentSplitRules } from "@/features/settings/split-settings.service";
import { calculateAsaasSplitsForOrder, sumAsaasSplitsInCents } from "@/features/payments/asaas-split.service";
import { getPublicSeatMapForEvent } from "@/features/seat-maps/seat-map.service";
import { shouldHideWhenSoldOut } from "@/features/hospitality/hotel-lot-rules";
import { calculateServiceFeeInCents, roundPublicPriceUpInCents } from "@/features/pricing/pricing";
import { buildEventSeo } from "@/features/seo/event-seo";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { imageCropFromBannerPosition, imageCropStyle, parseImageCrop } from "@/lib/image-crop";
import { TrackingRuntime } from "./TrackingRuntime";
import { CheckoutEstimator } from "./CheckoutEstimator";
import { TicketQuantityStepper } from "./TicketQuantityStepper";
import { TicketTypeSelector } from "./TicketTypeSelector";
import { AddToCartButton } from "./AddToCartButton";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type EventDirectionsInput = {
  googleMapsUrl?: string | null;
  venueName: string;
  venueAddress: string;
  city: string;
  state: string;
};

type TicketCardStyle = CSSProperties & {
  "--ticket-highlight-color"?: string;
};

function normalizeGoogleMapsUrl(value?: string | null) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const isGoogleHost = host.includes("google.") || host === "maps.app.goo.gl" || host === "goo.gl";
    const hasMapsPath = url.pathname.includes("/maps") || host.startsWith("maps.") || host === "maps.app.goo.gl";

    if (!isGoogleHost || !hasMapsPath) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function getEventLocationQuery(event: EventDirectionsInput) {
  return [event.venueName, event.venueAddress, event.city, event.state].filter(Boolean).join(", ");
}

function getMapsQueryFromUrl(url: URL) {
  const queryParam = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("destination");

  if (queryParam) {
    return queryParam;
  }

  const placeParts = url.pathname.split("/").filter(Boolean);
  const placeIndex = placeParts.findIndex((part) => part === "place");

  if (placeIndex >= 0 && placeParts[placeIndex + 1]) {
    return decodeURIComponent(placeParts[placeIndex + 1].replace(/\+/g, " "));
  }

  const coordinates = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return coordinates ? `${coordinates[1]},${coordinates[2]}` : null;
}

function buildEventDirections(event: EventDirectionsInput) {
  const mapsUrl = normalizeGoogleMapsUrl(event.googleMapsUrl);

  if (!mapsUrl) {
    return null;
  }

  const fallbackQuery = getEventLocationQuery(event);
  const mapQuery = getMapsQueryFromUrl(mapsUrl) || fallbackQuery;

  if (!mapQuery) {
    return null;
  }

  const embedUrl = mapsUrl.pathname.includes("/maps/embed")
    ? mapsUrl.toString()
    : `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;

  return {
    embedUrl,
    directionsUrl: mapsUrl.toString(),
    locationLabel: event.venueName || `${event.city}, ${event.state}`
  };
}

function getAvailableTypeOptions<T extends { status: string; soldQuantity: number; reservedQuantity: number }>(options: T[]) {
  return options.filter((option) => option.status === "ACTIVE" && option.soldQuantity + option.reservedQuantity === 0);
}

function getTicketHighlightStyle(color?: string | null): TicketCardStyle | undefined {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return undefined;
  }

  return {
    "--ticket-highlight-color": color
  };
}

function getTicketDescriptionTopics(description?: string | null) {
  return String(description ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getEditorialParagraphs(value?: string | null) {
  return String(value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getImportantInfoTopics(value?: string | null) {
  return String(value ?? "")
    .split(/\r?\n|(?<=\.)\s+/)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function getAvailableLotQuantity(lot: {
  hasTypeOptions: boolean;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  typeOptions: Array<{ status: string; soldQuantity: number; reservedQuantity: number }>;
}) {
  if (lot.hasTypeOptions) {
    return getAvailableTypeOptions(lot.typeOptions).length;
  }

  return Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0);
}

function getLotSaleBadge(lot: {
  saleBadge?: string | null;
  status: string;
  hasTypeOptions: boolean;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  typeOptions: Array<{ status: string; soldQuantity: number; reservedQuantity: number }>;
}) {
  const available = getAvailableLotQuantity(lot);

  if (lot.saleBadge === "SOLD_OUT" || lot.status === "SOLD_OUT" || available <= 0) {
    return {
      label: "Esgotado",
      tone: "soldOut" as const
    };
  }

  if (lot.saleBadge === "LOW_STOCK") {
    return {
      label: "Últimos ingressos",
      tone: "lowStock" as const
    };
  }

  return null;
}

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
  const [event, companySettings, splitRules] = await Promise.all([
    getCachedPublicEventBySlugInOrganization(slug, organizationContext.organization.id),
    getCompanySettingsByOrganizationId(organizationContext.organization.id),
    listPaymentSplitRules(organizationContext.organization.id)
  ]);

  if (!event) {
    notFound();
  }

  const now = new Date();
  const seatMapLayout = await getPublicSeatMapForEvent(event.id);
  const hasNumberedSeatMap = Boolean(seatMapLayout);
  const visibleLots = event.lots.filter((lot) => {
    const startsOk = !lot.salesStartsAt || lot.salesStartsAt <= now;
    const endsOk = !lot.salesEndsAt || lot.salesEndsAt >= now;
    const hasStock = getAvailableLotQuantity(lot) > 0;
    const isSoldOut = lot.saleBadge === "SOLD_OUT" || lot.status === "SOLD_OUT" || !hasStock;

    if (shouldHideWhenSoldOut(lot) && isSoldOut) {
      return false;
    }

    return startsOk && endsOk;
  });
  const purchasableLots = visibleLots.filter((lot) => {
    const hasStock = getAvailableLotQuantity(lot) > 0;
    return lot.status === "ACTIVE" && lot.saleBadge !== "SOLD_OUT" && hasStock;
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
  const highlightedLotId = event.highlightedLotId || purchasableLots[0]?.id;
  const eventLead = event.subtitle?.trim() || "";
  const checkoutEstimatorLots = purchasableLots.map((lot) => ({
    id: lot.id,
    name: lot.name,
    totalWithFeeInCents:
      lot.priceInCents +
      Math.max(
        calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps),
        sumAsaasSplitsInCents(
          calculateAsaasSplitsForOrder([{ quantity: 1, totalInCents: lot.priceInCents }], splitRules)
        )
      )
  }));
  const advertisedLotPriceById = new Map(
    checkoutEstimatorLots.map((lot) => [
      lot.id,
      roundPublicPriceUpInCents(lot.totalWithFeeInCents + companySettings.pixTransactionFeeInCents)
    ])
  );
  const publicSocialSettings = companySettings as typeof companySettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
  };
  const eventDirections = buildEventDirections(event);
  const descriptionParagraphs = getEditorialParagraphs(event.description);
  const importantInfoTopics = getImportantInfoTopics(event.importantInfo);

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

      <section className={`container publicGrid ${hasNumberedSeatMap ? "hasNumberedSeatMap" : ""}`}>
        <article className="publicContent">
          {descriptionParagraphs.length > 0 ? (
            <section className="eventInfoBlock eventDescriptionBlock">
              <span className="eyebrow">Experiência do evento</span>
              <h2>Descrição do evento</h2>
              <div className="eventInfoText">
                {descriptionParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          {importantInfoTopics.length > 0 ? (
            <section className="eventInfoBlock eventImportantInfoBlock">
              <span className="eyebrow">Antes de comprar</span>
              <h2>Informações importantes</h2>
              <ul className="eventInfoList">
                {importantInfoTopics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {!hasNumberedSeatMap && event.eventMapLayout ? (
            <EventMapView layout={event.eventMapLayout} notes={event.eventMapNotes} />
          ) : !hasNumberedSeatMap && event.eventMapImageUrl ? (
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
              <p className="eventModularMapNotice">Imagem meramente ilustrativa do local.</p>
              {event.eventMapNotes ? <p className="mapNotes">{event.eventMapNotes}</p> : null}
            </section>
          ) : null}
        </article>

        <aside className="purchasePanel" id="ingressos">
          {!hasNumberedSeatMap ? (
            <div className="purchaseStickyLabel">
              <span>Ingressos disponíveis</span>
              <strong>Selecione seus ingressos</strong>
            </div>
          ) : null}

          <div className="zeroFeeCampaign" role="note">
            <strong>Taxa zero</strong>
            <span>Aproveite seus ingressos com taxa zero.</span>
          </div>

          {visibleLots.length === 0 ? (
            <div className="empty">Nenhum ingresso disponível no momento.</div>
          ) : (
            <form
              action={`/evento/${event.slug}/checkout`}
              className={`form ${hasNumberedSeatMap ? "numberedSeatCheckoutForm" : ""}`}
              method="get"
              noValidate
            >
              <ErrorNotice message={checkoutError} />
              <input type="hidden" name="utm_source" value={tracking.utmSource ?? ""} />
              <input type="hidden" name="utm_medium" value={tracking.utmMedium ?? ""} />
              <input type="hidden" name="utm_campaign" value={tracking.utmCampaign ?? ""} />
              <input type="hidden" name="utm_content" value={tracking.utmContent ?? ""} />
              <input type="hidden" name="utm_term" value={tracking.utmTerm ?? ""} />
              <input type="hidden" name="ref" value={tracking.referrer ?? ""} />
              <input type="hidden" name="landingPage" value={tracking.landingPage ?? ""} />
              {typeof query.fbclid === "string" ? <input type="hidden" name="fbclid" value={query.fbclid} /> : null}
              {seatMapLayout ? (
                <SeatMapTicketSelector layout={seatMapLayout} maxSelection={8} />
              ) : (
              <div className="ticketPickerList">
                {visibleLots.map((lot) => {
                  const available = getAvailableLotQuantity(lot);
                  const availableOptions = lot.hasTypeOptions ? getAvailableTypeOptions(lot.typeOptions) : [];
                  const descriptionTopics = lot.descriptionAsList ? getTicketDescriptionTopics(lot.description) : [];
                  const isLowStock = available <= 25;
                  const saleBadge = getLotSaleBadge(lot);
                  const isSoldOut = saleBadge?.tone === "soldOut";
                  const lotEndsSoon = lot.salesEndsAt
                    ? lot.salesEndsAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000
                    : false;
                  const isHighlighted = lot.id === highlightedLotId;
                  const maxQuantity = Math.max(0, Math.min(lot.maxPerOrder, available));
                  const highlightStyle = getTicketHighlightStyle(lot.highlightColor);

                  return (
                    <article
                      className={`ticketPickerCard ${isHighlighted ? "recommendedLot" : ""} ${highlightStyle ? "hasTicketHighlight" : ""} ${isSoldOut ? "isSoldOut" : ""}`}
                      key={lot.id}
                      style={highlightStyle}
                    >
                      <div className="ticketPickerInfo">
                        <div className="ticketPickerTitleRow">
                          <strong className="ticketPickerTitle">{lot.name}</strong>
                          {!isSoldOut ? <span className="zeroFeeBadge">SEM TAXA</span> : null}
                          {saleBadge ? (
                            <span className={`ticketSaleBadge ${saleBadge.tone}`}>
                              {saleBadge.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="ticketPickerPrice">
                          {formatCurrency(advertisedLotPriceById.get(lot.id) ?? lot.priceInCents)}
                        </p>
                        {descriptionTopics.length > 0 ? (
                          <ul className="ticketDescriptionList">
                            {descriptionTopics.map((topic) => (
                              <li key={topic}>{topic}</li>
                            ))}
                          </ul>
                        ) : lot.description ? (
                          <small>{lot.description}</small>
                        ) : null}
                        {lot.admissionsPerUnit > 1 ? (
                          <small className="ticketPickerAdmissionNote">
                            Cada compra gera {lot.admissionsPerUnit} QR Codes individuais.
                          </small>
                        ) : null}
                        {!isSoldOut && (isLowStock || lotEndsSoon) ? (
                          <small className="ticketPickerUrgency">
                            {isLowStock ? `Últimos ${available} ingressos` : "Lote vira em breve"}
                          </small>
                        ) : null}
                      </div>
                      {isSoldOut ? (
                        <div className="ticketSoldOutControl" aria-label={`${lot.name} esgotado`}>
                          Indisponível
                        </div>
                      ) : lot.hasTypeOptions ? (
                        <TicketTypeSelector
                          label={lot.name}
                          lotId={lot.id}
                          options={availableOptions.map((option) => ({
                            id: option.id,
                            label: option.label
                          }))}
                        />
                      ) : (
                        <TicketQuantityStepper
                          label={lot.name}
                          lotId={lot.id}
                          max={maxQuantity}
                          name={`quantity_${lot.id}`}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
              )}

              {!seatMapLayout && purchasableLots.length > 0 ? (
                <CheckoutEstimator
                  fixedOrderFeeInCents={companySettings.pixTransactionFeeInCents}
                  lots={checkoutEstimatorLots}
                />
              ) : null}

              {purchasableLots.length > 0 ? (
                <>
                  <AddToCartButton />
                  <p className="checkoutFootnote">
                    Você informará seus dados e concluirá o pedido na próxima etapa.
                  </p>
                </>
              ) : (
                <p className="checkoutFootnote">
                  Todos os ingressos visíveis estão esgotados no momento.
                </p>
              )}
            </form>
          )}
        </aside>
      </section>
      {eventDirections ? (
        <section className="container eventDirectionsBlock" aria-labelledby="event-directions-title">
          <div className="eventDirectionsHeader">
            <div>
              <span>Localização</span>
              <h2 id="event-directions-title">Como chegar ao evento</h2>
              <p>{eventDirections.locationLabel}</p>
            </div>
            <a className="secondaryButton" href={eventDirections.directionsUrl} target="_blank" rel="noreferrer">
              Abrir rota no Google Maps
            </a>
          </div>
          <div className="eventDirectionsFrame">
            <iframe
              title={`Como chegar ao evento ${event.title}`}
              src={eventDirections.embedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}
      <PublicSiteFooter brandName={organizationContext.brandName} settings={publicSocialSettings} />
      {event.supportWhatsappUrl ? <WhatsappFloatingButton href={event.supportWhatsappUrl} /> : null}
    </main>
  );
}
