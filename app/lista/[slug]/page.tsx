import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { createEventLeadAction } from "@/features/leads/lead.actions";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { formatDateTime } from "@/lib/format";
import { imageCropStyle, parseImageCrop } from "@/lib/image-crop";

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
    event.leadCaptureOfferText || "Entre na lista e receba prioridade no lançamento, desconto e informações oficiais.";
  const ctaText = event.leadCaptureCtaText || "Quero entrar na lista";
  const youtubeEmbedUrl = getYoutubeEmbedUrl(event.leadCaptureVideoUrl);
  const tracking = getTrackingParamsFromSearch(query, `/lista/${event.slug}`);
  const venueGallery = getVenueGalleryUrls(event.leadCaptureVenueGallery);

  return (
    <main className="shell leadCaptureShell">
      <header className="topbar">
        <Link className="brand" href="/">
          {organizationContext.brandLogoUrl ? (
            <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
          ) : (
            <span className="brandMark">{organizationContext.brandMark}</span>
          )}
          <span>{organizationContext.brandName}</span>
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
            <h1>{headline}</h1>
            <p>{renderEditableText(description, "hero-description")}</p>
            <div className="leadCaptureMeta">
              <span>{formatDateTime(event.startsAt)}</span>
              <span>
                {event.city}, {event.state}
              </span>
              <span>{event.venueName}</span>
            </div>
          </article>

          <form action={createEventLeadAction} className="leadCaptureForm card" id="lead-capture-form">
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="eventSlug" value={event.slug} />
            <input type="hidden" name="utmSource" value={tracking.utmSource || ""} />
            <input type="hidden" name="utmMedium" value={tracking.utmMedium || ""} />
            <input type="hidden" name="utmCampaign" value={tracking.utmCampaign || ""} />
            <input type="hidden" name="utmContent" value={tracking.utmContent || ""} />
            <input type="hidden" name="utmTerm" value={tracking.utmTerm || ""} />
            <input type="hidden" name="referrer" value={tracking.referrer || ""} />
            <input type="hidden" name="landingPage" value={tracking.landingPage || ""} />
            <span className="leadFormEyebrow">Cadastre seu interesse</span>
            <h2>Receba o aviso de abertura e o link do grupo oficial</h2>
            <p className="muted">
              {renderEditableText(
                "Preencha seus dados e conclua o último passo na página de obrigado para entrar no grupo.",
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
            <SubmitButton className="button fullButton" pendingText="Enviando cadastro...">
              {ctaText}
            </SubmitButton>
            <small className="leadCaptureFootnote">
              Seus dados serão usados apenas para este lançamento, avisos oficiais e acesso ao grupo.
            </small>
          </form>
        </div>
      </section>

      <section className="leadCaptureBody">
        <article className="leadCaptureSection card">
          <div className="sectionHeader">
            <div>
              <span className="leadEyebrow">Como funciona</span>
              <h2>Um fluxo simples para não perder a abertura</h2>
            </div>
          </div>
          <div className="leadStepsGrid">
            <article className="leadStepCard">
              <strong>1. Cadastre seus dados</strong>
              <p>Você deixa seu nome, e-mail e telefone para entrar na pré-lista oficial deste evento.</p>
            </article>
            <article className="leadStepCard">
              <strong>2. Acesse o grupo no WhatsApp</strong>
              <p>Na página seguinte, você entra no grupo onde vamos liberar avisos, bônus e o desconto da abertura.</p>
            </article>
            <article className="leadStepCard">
              <strong>3. Receba prioridade na abertura</strong>
              <p>Quem estiver no grupo acompanha primeiro a liberação e recebe o contexto completo do lançamento.</p>
            </article>
          </div>
        </article>

        <section className="leadCaptureSection leadCaptureSectionSplit">
          <article className="card leadCaptureHighlight">
            <span className="leadEyebrow">Por que entrar agora</span>
            <h2>Mais clareza, mais contexto e mais chance de comprar no melhor momento.</h2>
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
        </section>

        {youtubeEmbedUrl ? (
          <section className="leadCaptureSection card leadVideoSection">
            <div className="sectionHeader">
              <div>
                <span className="leadEyebrow">Convite em vídeo</span>
                <h2>Assista ao convite e entenda a proposta do evento</h2>
              </div>
            </div>
            <p className="muted">
              {renderEditableText(
                "Esse vídeo ajuda a aquecer a decisão e aumentar a intenção antes da abertura oficial.",
                "video-copy"
              )}
            </p>
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

        {venueGallery.length > 0 ? (
          <section className="leadCaptureSection card leadCaptureVenueSection">
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
    </main>
  );
}
