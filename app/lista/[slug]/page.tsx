import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { TurnstileField } from "@/components/forms/TurnstileField";
import { createEventLeadAction } from "@/features/leads/lead.actions";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
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

type LeadPairBlock = {
  title: string;
  description: string;
};

function parsePipeBlocks(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split("|");
      return {
        title: title?.trim() || "",
        description: rest.join("|").trim()
      };
    })
    .filter((item) => item.title);
}

function renderEditableText(value: string, keyPrefix: string) {
  const lines = value.split("\n");

  return lines.map((line, lineIndex) => {
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
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export async function generateMetadata({ params }: Pick<LeadCapturePageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const event = await getLeadCaptureEventBySlug(slug, organizationContext.organization.id);

  if (!event) {
    return {
      title: `Lista de interesse indisponível | ${organizationContext.brandName}`,
      robots: { index: false, follow: false }
    };
  }

  return {
    title: `${event.leadCaptureHeadline || event.title} | Lista de interesse`,
    description:
      event.leadCaptureHeroSupportText ||
      event.leadCaptureDescription ||
      "Cadastre-se para receber informações e entrar no grupo oficial do evento.",
    robots: { index: false, follow: false }
  };
}

export default async function LeadCapturePage({ params, searchParams }: LeadCapturePageProps) {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ slug }, query, organizationContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(emptySearchParams),
    getCurrentOrganizationContext()
  ]);

  const event = await getLeadCaptureEventBySlug(slug, organizationContext.organization.id);

  if (!event) {
    notFound();
  }

  const heroImage =
    event.leadCaptureHeroImageUrl ||
    event.bannerUrl ||
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1800&q=80";
  const leadHeroCrop = parseImageCrop(event.leadCaptureHeroCrop) || parseImageCrop(event.bannerCrop);
  const publicLeadHeroCrop = leadHeroCrop;
  const rawError = typeof query.error === "string" ? query.error : null;
  const error = rawError === "NEXT_REDIRECT" ? null : rawError;
  const tracking = getTrackingParamsFromSearch(query, `/lista/${event.slug}`);
  const turnstileSiteKey = getTurnstileSiteKey();

  const badgeText = event.leadCaptureBadgeText || "Vagas limitadas";
  const headline = event.leadCaptureHeadline || event.title;
  const heroSupportText =
    event.leadCaptureHeroSupportText ||
    event.subtitle ||
    "Uma noite que pode **transformar** o seu casamento **para sempre**.";
  const benefits = parsePipeBlocks(event.leadCaptureBenefitsText);
  const footerStats = parsePipeBlocks(event.leadCaptureFooterStatsText);
  const bonusBlock = parsePipeBlocks(event.leadCaptureBonusText)[0];
  const formEyebrow = event.leadCaptureFormIntroEyebrow || "Garanta seu acesso";
  const formIntroTitle =
    event.leadCaptureFormIntroTitle || "Entre para a lista e garanta seu lugar com desconto exclusivo.";
  const formIntroDescription =
    event.leadCaptureFormIntroDescription ||
    event.leadCaptureOfferText ||
    "Preencha seus dados e receba o link do grupo oficial na próxima etapa.";
  const formTimingText = event.leadCaptureFormTimingText || "Leva menos de 30 segundos";
  const ctaText = event.leadCaptureCtaText || event.conversionCtaText || "QUERO GARANTIR MEU DESCONTO AGORA";
  const formattedDate = formatDateTime(event.startsAt);
  const [datePart, timePartRaw] = formattedDate.split(", ");
  const timePart = timePartRaw || "";

  const defaultBenefits: LeadPairBlock[] =
    benefits.length > 0
      ? benefits
      : [
          { title: "Acesso antecipado", description: "Quem está na lista entra primeiro no grupo oficial." },
          { title: "Desconto exclusivo", description: "Ganhe até 30% de desconto no lançamento." },
          { title: "Vagas limitadas", description: "Ingressos limitados para garantir a melhor experiência." }
        ];

  const defaultFooterStats: LeadPairBlock[] =
    footerStats.length > 0
      ? footerStats
      : [
          { title: "+ de 100 mil", description: "pessoas impactadas" },
          { title: "10 anos", description: "transformando famílias" },
          { title: "Milhares de casais", description: "fortalecendo seus lares" }
        ];

  return (
    <main className="shell leadCaptureShell leadCapturePremiumShell">
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
        eventId={event.id}
        eventTitle={event.title}
        eventSlug={event.slug}
        metaPixelId={event.metaPixelId}
        googleTagManagerId={event.googleTagManagerId}
        tracking={tracking}
        mode="view"
      />

      <section className="leadPremiumStage">
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

        <div className="leadPremiumCanvas">
          <section className="leadPremiumHero">
            <div className="leadPremiumHeroImageWrap">
              <img
                alt={headline}
                className={leadHeroCrop ? "croppedImage" : ""}
                decoding="async"
                fetchPriority="high"
                src={heroImage}
                style={imageCropStyle(publicLeadHeroCrop)}
              />
            </div>
            <div className="leadPremiumHeroCopy">
              <span className="leadPremiumBadge">{badgeText}</span>
              <h1>{renderEditableText(headline, "premium-headline")}</h1>
              <div className="leadPremiumMetaRow">
                <div className="leadPremiumMetaItem">
                  <strong>{datePart}</strong>
                  <span>{timePart}</span>
                </div>
                <div className="leadPremiumMetaItem">
                  <strong>
                    {event.city}, {event.state}
                  </strong>
                  <span>Cidade do evento</span>
                </div>
                <div className="leadPremiumMetaItem">
                  <strong>{event.venueName}</strong>
                  <span>Local do encontro</span>
                </div>
              </div>
            </div>
          </section>

          <section className="leadPremiumBenefits">
            {defaultBenefits.slice(0, 3).map((item, index) => (
              <article className="leadPremiumBenefit" key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </section>

          <section className="leadPremiumFormSection" id="lead-capture-form">
            <div className="leadPremiumFormIntro">
              <span className="leadEyebrow">{formEyebrow}</span>
              <h2>{renderEditableText(formIntroTitle, "premium-form-title")}</h2>
              <p>{renderEditableText(formIntroDescription, "premium-form-description")}</p>

              {bonusBlock ? (
                <div className="leadPremiumBonusCard">
                  <strong>{bonusBlock.title}</strong>
                  <p>{bonusBlock.description}</p>
                </div>
              ) : null}

            </div>

            <form action={createEventLeadAction} className="leadPremiumFormPane" id="lead-capture-premium-form">
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

              <div className="leadPremiumFormTiming">{formTimingText}</div>
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
                <span>Município</span>
                <input name="municipality" placeholder="Ex: Santo André, São Caetano, São Bernardo" required />
              </label>
              <label className="field">
                <span>Telefone com DDD</span>
                <input name="phone" inputMode="tel" placeholder="Ex: (11) 99999-9999" required />
              </label>
              <TurnstileField siteKey={turnstileSiteKey} />
              <SubmitButton className="button fullButton leadPremiumCtaButton" pendingText="Enviando cadastro...">
                {ctaText}
              </SubmitButton>
            </form>
          </section>

          <section className="leadPremiumFooterStats">
            {defaultFooterStats.slice(0, 3).map((item, index) => (
              <article className="leadPremiumFooterStat" key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
