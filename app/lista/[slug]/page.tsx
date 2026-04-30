import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TurnstileField } from "@/components/forms/TurnstileField";
import { createEventLeadAction } from "@/features/leads/lead.actions";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { getTurnstileSiteKey } from "@/features/leads/turnstile.service";
import { formatDateTime } from "@/lib/format";
import { imageCropStyle, parseImageCrop } from "@/lib/image-crop";
import { MetaTrackingFields } from "@/app/evento/[slug]/MetaTrackingFields";
import { LeadCaptureTrackingRuntime } from "./LeadCaptureTrackingRuntime";

type LeadCapturePageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<LeadCapturePageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const event = await getLeadCaptureEventBySlug(slug, organizationContext.organization.id);

  if (!event) {
    return {
      title: `Lista de interesse indisponível | ${organizationContext.brandName}`,
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: `${event.leadCaptureHeadline || event.title} | Lista de interesse`,
    description:
      event.leadCaptureOfferText ||
      event.leadCaptureDescription ||
      "Cadastre-se para receber informações e entrar no grupo oficial do evento.",
    robots: {
      index: false,
      follow: false
    }
  };
}

function getYoutubeEmbedUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "").trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return `https://www.youtube.com${parsed.pathname}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getVenueGalleryUrls(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item && (item.startsWith("http://") || item.startsWith("https://") || item.startsWith("/uploads/")));
}

function renderEditableText(value: string, keyPrefix: string) {
  return value.split("\n").map((line, lineIndex) => {
    const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);

    return (
      <span key={`${keyPrefix}-${lineIndex}`}>
        {parts.map((part, partIndex) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={`${keyPrefix}-${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={`${keyPrefix}-${lineIndex}-${partIndex}`}>{part}</span>
          )
        )}
        {lineIndex < value.split("\n").length - 1 ? <br /> : null}
      </span>
    );
  });
}

export default async function LeadCapturePage({ params, searchParams }: LeadCapturePageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const event = await getLeadCaptureEventBySlug(slug, organizationContext.organization.id);

  if (!event) {
    notFound();
  }

  const heroImage =
    event.leadCaptureHeroImageUrl ||
    event.bannerUrl ||
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1800&q=80";
  const leadHeroCrop = parseImageCrop(event.leadCaptureHeroCrop) || parseImageCrop(event.bannerCrop);
  const publicLeadHeroCrop = leadHeroCrop ? { ...leadHeroCrop, zoom: Math.max(1, leadHeroCrop.zoom) } : null;
  const error = typeof query.error === "string" ? query.error : null;
  const headline = event.leadCaptureHeadline || event.title;
  const description =
    event.leadCaptureDescription ||
    event.subtitle ||
    "Cadastre-se para receber as informações do evento, prioridade de abertura e o link do grupo oficial.";
  const offerText =
    event.leadCaptureOfferText || "Entre na lista e receba o aviso de abertura, o desconto e o acesso ao grupo oficial.";
  const ctaText = event.leadCaptureCtaText || "Quero entrar na lista";
  const youtubeEmbedUrl = getYoutubeEmbedUrl(event.leadCaptureVideoUrl);
  const tracking = getTrackingParamsFromSearch(query, `/lista/${event.slug}`);
  const turnstileSiteKey = getTurnstileSiteKey();
  const companySettings = await getCompanySettingsByOrganizationId(organizationContext.organization.id);
  const publicSocialSettings = companySettings as typeof companySettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
  };
  const venueGallery = getVenueGalleryUrls(event.leadCaptureVenueGallery);

  return (
    <main className="shell leadCaptureShell">
      {event.googleTagManagerId ? (
        <>
          <Script id="lead-capture-gtm-script" strategy="afterInteractive">
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
        <Script id="lead-capture-meta-pixel" strategy="afterInteractive">
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
      <LeadCaptureTrackingRuntime
        eventTitle={event.title}
        eventSlug={event.slug}
        metaPixelId={event.metaPixelId}
        googleTagManagerId={event.googleTagManagerId}
        tracking={tracking}
        mode="view"
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
      </header>

      <section className="leadCaptureHero">
        <div className={`leadCaptureHeroMedia ${leadHeroCrop ? "hasCrop" : ""}`}>
          <img
            className={leadHeroCrop ? "croppedImage" : ""}
            alt={headline}
            src={heroImage}
            style={imageCropStyle(publicLeadHeroCrop)}
          />
        </div>
        <div className="leadCaptureHeroBottom">
          <article className="leadCaptureHeroCopy">
            <span className="leadEyebrow">Pré-lista oficial do evento</span>
            <h1>{headline}</h1>
            <p>{renderEditableText(description, "hero-description")}</p>
            <div className="leadOfferBox">
              <strong>{offerText}</strong>
              <small>Cadastro rápido, grupo oficial e instruções certas no mesmo fluxo.</small>
            </div>
            <div className="leadCaptureMeta">
              <span>{formatDateTime(event.startsAt)}</span>
              <span>
                {event.city}, {event.state}
              </span>
              <span>{event.venueName}</span>
            </div>
            <div className="leadCaptureHeroProof">
              <div>
                <strong>Cadastro rápido</strong>
                <small>Você entra na lista e segue para o grupo na próxima etapa.</small>
              </div>
              <div>
                <strong>Grupo oficial do lançamento</strong>
                <small>É lá que ficam abertura, orientações e as condições especiais.</small>
              </div>
            </div>
          </article>

          <form action={createEventLeadAction} className="leadCaptureForm card" id="lead-capture-form">
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="eventSlug" value={event.slug} />
            <MetaTrackingFields />
            <input type="hidden" name="utmSource" value={tracking.utmSource || ""} />
            <input type="hidden" name="utmMedium" value={tracking.utmMedium || ""} />
            <input type="hidden" name="utmCampaign" value={tracking.utmCampaign || ""} />
            <input type="hidden" name="utmContent" value={tracking.utmContent || ""} />
            <input type="hidden" name="utmTerm" value={tracking.utmTerm || ""} />
            <input type="hidden" name="referrer" value={tracking.referrer || ""} />
            <input type="hidden" name="landingPage" value={tracking.landingPage || ""} />
            <input
              aria-hidden="true"
              autoComplete="off"
              className="leadHoneypotField"
              name="company"
              tabIndex={-1}
              type="text"
            />
            <span className="leadFormEyebrow">Cadastre seu interesse</span>
            <h2>Entre na lista e receba o link do grupo oficial</h2>
            <p className="muted">
              {renderEditableText(
                "Preencha seus dados e, na próxima tela, entre no grupo para receber a abertura e o desconto.",
                "form-copy"
              )}
            </p>
            {error ? <div className="errorBox">{error}</div> : null}
            <label className="field">
              <span>Nome completo</span>
              <input name="name" placeholder="Seu nome completo" required />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input name="email" type="email" placeholder="Digite seu melhor e-mail" required />
            </label>
            <label className="field">
              <span>Telefone com DDI + DDD</span>
              <input name="phone" inputMode="tel" placeholder="Ex: 55 11 99999-9999" required />
            </label>
            <TurnstileField siteKey={turnstileSiteKey} />
            <SubmitButton className="button fullButton" pendingText="Enviando cadastro...">
              {ctaText}
            </SubmitButton>
            <div className="leadCaptureFormBenefits">
              <span>Aviso da abertura</span>
              <span>Grupo oficial</span>
              <span>Prioridade no lançamento</span>
            </div>
            <small className="leadCaptureFootnote">
              Seus dados serão usados apenas para este lançamento, avisos oficiais e acesso ao grupo.
            </small>
            <small className="leadCaptureFootnote leadCaptureFootnoteSoft">
              Sem pagamento agora. Você só entra na lista e segue para o grupo oficial.
            </small>
          </form>
        </div>
      </section>

      <section className="leadCaptureBody">
        {youtubeEmbedUrl ? (
          <section className="leadCaptureSection card leadVideoSection leadCapturePrioritySection">
            <span className="leadEyebrow">MAIS IFORMAÇÕES</span>
            <div className="leadVideoFrame">
              <iframe
                src={youtubeEmbedUrl}
                title={`Vídeo de apresentação de ${headline}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </section>
        ) : null}

        <div className="leadCaptureInfoGrid">
          <article className="leadCaptureSection card leadCaptureSectionTone leadToneProcess">
            <div className="sectionHeader">
              <div>
                <span className="leadEyebrow">Como funciona</span>
                <h2>3 passos para receber o aviso e entrar no grupo</h2>
              </div>
            </div>
            <div className="leadStepsGrid">
              <article className="leadStepCard">
                <strong>1. Cadastre seus dados</strong>
                <p>Você deixa nome, e-mail e telefone para entrar na pré-lista oficial deste evento.</p>
              </article>
              <article className="leadStepCard">
                <strong>2. Acesse o grupo no WhatsApp</strong>
                <p>Na página seguinte, você entra no grupo onde vamos liberar avisos, bônus e o desconto da abertura.</p>
              </article>
              <article className="leadStepCard">
                <strong>3. Receba prioridade na abertura</strong>
                <p>Quem estiver no grupo acompanha primeiro a liberação e recebe a comunicação completa do lançamento.</p>
              </article>
            </div>
          </article>

          <article className="card leadCaptureHighlight leadCaptureSectionTone leadToneValue">
            <span className="leadEyebrow">Por que entrar agora</span>
            <h2>Receba a abertura no canal certo e chegue mais preparado ao lançamento.</h2>
            <p>
              {renderEditableText(
                "A lista de interesse evita que você dependa de anúncio solto ou de link perdido. Você entra no funil oficial deste lançamento e recebe as próximas instruções no canal certo.",
                "highlight-copy"
              )}
            </p>
            <ul className="leadChecklist">
              <li>cadastro confirmado em poucos segundos</li>
              <li>grupo oficial para concentrar avisos e condições especiais</li>
              <li>comunicação mais organizada antes da venda abrir</li>
            </ul>
          </article>
        </div>

        {venueGallery.length > 0 ? (
          <section className="leadCaptureSection card leadCaptureVenueSection leadCaptureSectionTone leadToneVenue">
            <div className="sectionHeader">
              <div>
                <span className="leadEyebrow">Conheça o local</span>
                <h2>Veja o ambiente onde este encontro vai acontecer</h2>
              </div>
              <a className="secondaryButton" href="#lead-capture-form">
                Entrar na lista
              </a>
            </div>
            <div className="leadCaptureVenueInfo">
              <strong>{event.venueName}</strong>
              <p>
                {event.venueAddress} · {event.city}, {event.state}
              </p>
            </div>
            <div className="leadCaptureVenueGallery">
              {venueGallery.map((imageUrl, index) => (
                <figure className="leadCaptureVenueCard" key={`${imageUrl}-${index}`}>
                  <img alt={`${event.venueName} ${index + 1}`} src={imageUrl} />
                </figure>
              ))}
            </div>
          </section>
        ) : null}

      </section>
      <PublicSiteFooter brandName={organizationContext.brandName} settings={publicSocialSettings} />
    </main>
  );
}
