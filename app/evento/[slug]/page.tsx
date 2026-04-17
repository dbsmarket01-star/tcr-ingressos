import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getBuyerProfile } from "@/features/customer-auth/google-buyer.service";
import { getEventSeoBySlug, getPublicEventBySlug } from "@/features/events/event.service";
import { createCheckoutOrderAction } from "@/features/orders/order.actions";
import { calculateServiceFeeInCents } from "@/features/pricing/pricing";
import { buildEventSeo } from "@/features/seo/event-seo";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { TrackingRuntime } from "./TrackingRuntime";
import { CheckoutEstimator } from "./CheckoutEstimator";

export const dynamic = "force-dynamic";

const mapTemplateLabels = {
  AUTO: "Mapa automatico",
  AUDITORIUM: "Auditorio",
  THEATER: "Teatro",
  WAREHOUSE: "Galpao / arena",
  CLUB: "Clube / pista",
  FREE: "Setores livres"
};

function sectorLabelsFromLots(lotNames: string[]) {
  return lotNames.length > 0 ? lotNames.slice(0, 6) : ["Ouro", "Prata", "Camarote", "Galeria"];
}

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<EventPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventSeoBySlug(slug);

  if (!event) {
    return {
      title: "Evento nao encontrado | TCR Ingressos"
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
  const event = await getPublicEventBySlug(slug);
  const buyerProfile = await getBuyerProfile();

  if (!event) {
    notFound();
  }

  const activeLots = event.lots.filter((lot) => {
    const now = new Date();
    const startsOk = !lot.salesStartsAt || lot.salesStartsAt <= now;
    const endsOk = !lot.salesEndsAt || lot.salesEndsAt >= now;
    const hasStock = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity > 0;
    return startsOk && endsOk && hasStock;
  });

  const totalSold = event.lots.reduce((sum, lot) => sum + lot.soldQuantity, 0);
  const totalCapacity = event.lots.reduce((sum, lot) => sum + lot.totalQuantity, 0);
  const totalAvailable = event.lots.reduce(
    (sum, lot) => sum + Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0),
    0
  );
  const nextLotTurn = activeLots
    .map((lot) => lot.salesEndsAt)
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const checkoutError = typeof query.checkoutError === "string" ? query.checkoutError : null;
  const tracking = getTrackingParamsFromSearch(query, `/evento/${event.slug}`);
  const heroImage =
    event.bannerUrl ||
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80";
  const socialProofText = event.conversionSocialProofText || (totalSold > 0 ? `+${totalSold} ingressos vendidos` : "Vendas abertas");
  const urgencyText =
    event.conversionUrgencyText ||
    (totalAvailable <= 50 ? "Ultimas unidades disponiveis para este evento." : "Compra segura com confirmacao automatica.");
  const ctaText = event.conversionCtaText || "Garantir minha vaga";
  const highlightedLotId = event.highlightedLotId || activeLots[0]?.id;
  const fallbackSectorLabels = sectorLabelsFromLots(activeLots.map((lot) => lot.name));
  const mapTemplate = event.eventMapTemplate || "AUTO";
  const lowestTotalInCents = activeLots.reduce((lowest, lot) => {
    const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps);
    const total = lot.priceInCents + serviceFeeInCents;
    return lowest === 0 || total < lowest ? total : lowest;
  }, 0);
  const checkoutEstimatorLots = activeLots.map((lot) => ({
    id: lot.id,
    name: lot.name,
    totalWithFeeInCents: lot.priceInCents + calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps)
  }));

  return (
    <main className="shell">
      {event.googleTagManagerId ? (
        <>
          <Script id="tcr-gtm-script" strategy="afterInteractive">
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
        <Script id="tcr-meta-pixel" strategy="afterInteractive">
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
        eventTitle={event.title}
        eventSlug={event.slug}
        metaPixelId={event.metaPixelId}
        googleTagManagerId={event.googleTagManagerId}
        tracking={tracking}
      />
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>
        <nav className="nav" aria-label="Navegacao">
          <Link href="/admin">Painel</Link>
        </nav>
      </header>

      <section
        className="publicHero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(9, 20, 28, 0.9), rgba(9, 20, 28, 0.5)), url("${heroImage}")`,
          backgroundPosition: event.bannerPosition
        }}
      >
        <div className="publicHeroInner">
          <div className="publicBadge">Parcele em ate 12x</div>
          <h1>{event.title}</h1>
          {event.subtitle ? <p>{event.subtitle}</p> : null}
          <div className="publicMeta">
            <span>{formatDateTime(event.startsAt)}</span>
            <span>{event.city}, {event.state}</span>
          </div>
          <div className="heroActions">
            <a className="button" href="#ingressos">
              {ctaText}
            </a>
            <span>{socialProofText}</span>
          </div>
        </div>
      </section>

      <section className="container publicGrid">
        <article className="publicContent">
          <section className="conversionStrip" aria-label="Informacoes principais de venda">
            <div>
              <span>Compra</span>
              <strong>Pix e cartao</strong>
            </div>
            <div>
              <span>Entrega</span>
              <strong>QR Code automatico</strong>
            </div>
            <div>
              <span>Vendidos</span>
              <strong>{totalSold > 0 ? `+${totalSold}` : "Aberto"}</strong>
            </div>
            <div>
              <span>Disponiveis</span>
              <strong>{totalAvailable}</strong>
            </div>
          </section>

          <section>
            <h2>Descricao do evento</h2>
            <p>{event.description}</p>
          </section>

          <section className="contentBlock">
            <h2>Local do evento</h2>
            <div className="eventVenueCard">
              <div className="venueMainInfo">
                <span>Onde acontece</span>
                <strong>{event.venueName}</strong>
                <p>{event.venueAddress}</p>
                <small>
                  {event.city}, {event.state}
                </small>
              </div>
            </div>
          </section>

          {event.importantInfo ? (
            <section className="contentBlock">
              <h2>Informacoes importantes</h2>
              <p>{event.importantInfo}</p>
            </section>
          ) : null}

          <section className="contentBlock">
            <h2>Mapa de setores</h2>
            {event.eventMapImageUrl ? (
              <div className="eventMapImageFrame">
                <img src={event.eventMapImageUrl} alt={`Mapa de setores - ${event.title}`} />
              </div>
            ) : (
              <div className={`sectorMap mapTemplate mapTemplate${mapTemplate}`} aria-label="Mapa de setores do evento">
                <div className="mapTemplateHeader">
                  <span>{mapTemplateLabels[mapTemplate as keyof typeof mapTemplateLabels] ?? "Mapa de setores"}</span>
                  <strong>Setores sujeitos a disponibilidade</strong>
                </div>
                <div className="stage">PALCO</div>
                <div className="sectorGrid">
                  {fallbackSectorLabels.map((sectorLabel, index) => (
                    <div className={`sector ${index === 0 ? "sectorHighlight" : ""}`} key={`${sectorLabel}-${index}`}>
                      {sectorLabel}
                    </div>
                  ))}
                </div>
                {mapTemplate === "THEATER" ? <div className="sector balconySector">Balcao / mezanino</div> : null}
                {mapTemplate === "CLUB" ? <div className="sector loungeSector">Area social / apoio</div> : null}
                {event.eventMapNotes ? <p className="mapNotes">{event.eventMapNotes}</p> : null}
              </div>
            )}
          </section>
        </article>

        <aside className="purchasePanel" id="ingressos">
          <div className="purchaseStickyLabel">
            <span>Compra segura</span>
            <strong>Selecione seus ingressos</strong>
          </div>
          <div className="purchaseHeader">
            <div>
              <span className="muted">Ingressos</span>
              <strong>{socialProofText}</strong>
              {lowestTotalInCents > 0 ? <small>A partir de {formatCurrency(lowestTotalInCents)}</small> : null}
            </div>
            <a className="miniAnchorButton" href="#ingressos">Comprar</a>
          </div>
          <div className="checkoutTrustRow" aria-label="Garantias da compra">
            <span>Pix e cartao</span>
            <span>QR Code automatico</span>
            <span>Compra segura</span>
          </div>
          <div className="purchaseAlerts">
            <strong>{urgencyText}</strong>
            {nextLotTurn ? <span>Lote atual encerra em {formatDateTime(nextLotTurn)}</span> : null}
          </div>

          {activeLots.length === 0 ? (
            <div className="empty">Nenhum ingresso disponivel no momento.</div>
          ) : (
            <form action={createCheckoutOrderAction} className="form">
              {checkoutError ? <div className="errorBox">{checkoutError}</div> : null}
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="utmSource" value={tracking.utmSource ?? ""} />
              <input type="hidden" name="utmMedium" value={tracking.utmMedium ?? ""} />
              <input type="hidden" name="utmCampaign" value={tracking.utmCampaign ?? ""} />
              <input type="hidden" name="utmContent" value={tracking.utmContent ?? ""} />
              <input type="hidden" name="utmTerm" value={tracking.utmTerm ?? ""} />
              <input type="hidden" name="referrer" value={tracking.referrer ?? ""} />
              <input type="hidden" name="landingPage" value={tracking.landingPage ?? ""} />
              {activeLots.map((lot, index) => {
                const available = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity;
                const isLowStock = available <= 25;
                const soldPercent = lot.totalQuantity > 0 ? Math.round((lot.soldQuantity / lot.totalQuantity) * 100) : 0;
                const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, 1, lot.serviceFeeBps);
                const totalWithFeeInCents = lot.priceInCents + serviceFeeInCents;
                const lotEndsSoon = lot.salesEndsAt ? lot.salesEndsAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000 : false;
                const isHighlighted = lot.id === highlightedLotId;

                return (
                  <label className={`lotOption ${isHighlighted ? "recommendedLot" : ""}`} key={lot.id}>
                    <div className="lotOptionBody">
                      <div className="lotTitleRow">
                        <strong>{lot.name}</strong>
                        {isHighlighted ? <span>Mais escolhido</span> : null}
                      </div>
                      {lot.description ? <p className="muted">{lot.description}</p> : null}
                      <div className="lotPriceBox">
                        <div>
                          <span>Ingresso</span>
                          <strong>{formatCurrency(lot.priceInCents)}</strong>
                        </div>
                        <div>
                          <span>Taxas e impostos</span>
                          <strong>+ {formatCurrency(serviceFeeInCents)}</strong>
                        </div>
                        <div>
                          <span>Total unitario</span>
                          <strong>{formatCurrency(totalWithFeeInCents)}</strong>
                        </div>
                      </div>
                      <div className="lotAvailability">
                        <div className="progressTrack" aria-label={`${soldPercent}% vendido`}>
                          <span style={{ width: `${Math.min(soldPercent, 100)}%` }} />
                        </div>
                        <span className={isLowStock || lotEndsSoon ? "urgencyText" : "muted"}>
                          {isLowStock ? `Ultimos ${available} ingressos` : `${available} disponiveis`}
                          {lotEndsSoon ? " - lote vira em breve" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="lotQuantityBox">
                      <span>Qtd.</span>
                      <input type="hidden" name="lotId" value={lot.id} />
                      <input
                        aria-label={`Quantidade para ${lot.name}`}
                        max={Math.max(0, Math.min(lot.maxPerOrder, available))}
                        min="0"
                        name={`quantity_${lot.id}`}
                        step="1"
                        type="number"
                        defaultValue={isHighlighted && available > 0 ? "1" : "0"}
                      />
                    </div>
                  </label>
                );
              })}

              <CheckoutEstimator lots={checkoutEstimatorLots} />

              <div className="checkoutBuyer">
                <h2>Comprador</h2>
                <Link
                  className="googleButton"
                  href={`/api/auth/google/start?returnTo=${encodeURIComponent(`/evento/${event.slug}#ingressos`)}`}
                >
                  <span>G</span>
                  Continuar com Google
                </Link>
                {buyerProfile ? (
                  <p className="success">Dados preenchidos com sua conta Google: {buyerProfile.email}</p>
                ) : null}
                <label className="field">
                  <span>Nome completo</span>
                  <input name="buyerName" required defaultValue={buyerProfile?.name || ""} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input name="buyerEmail" type="email" required defaultValue={buyerProfile?.email || ""} />
                </label>
                <label className="field">
                  <span>CPF</span>
                  <input name="buyerDocument" required />
                </label>
                <label className="field">
                  <span>Telefone</span>
                  <input name="buyerPhone" />
                </label>
              </div>

              <label className="field">
                <span>Cupom de desconto</span>
                <input name="coupon" placeholder="Digite seu cupom" />
              </label>

              <SubmitButton className="button fullButton" pendingText="Criando pedido...">
                Garantir minha vaga agora
              </SubmitButton>
              <p className="checkoutFootnote">
                Pagamento processado com confirmacao automatica. O ingresso com QR Code e liberado apos aprovacao.
              </p>
            </form>
          )}
        </aside>
      </section>
      {activeLots.length > 0 ? (
        <a className="mobileCheckoutBar" href="#ingressos">
          <span>
            {activeLots.length} opcoes
            {lowestTotalInCents > 0 ? ` • desde ${formatCurrency(lowestTotalInCents)}` : ""}
          </span>
          <strong>{ctaText}</strong>
        </a>
      ) : null}
    </main>
  );
}
