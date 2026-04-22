import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { createEventLeadAction } from "@/features/leads/lead.actions";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
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
  const event = await getLeadCaptureEventBySlug(slug);

  if (!event) {
    return {
      title: "Lista de interesse indisponível | TCR Ingressos",
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

export default async function LeadCapturePage({ params, searchParams }: LeadCapturePageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const event = await getLeadCaptureEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const heroImage =
    event.leadCaptureHeroImageUrl ||
    event.bannerUrl ||
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1800&q=80";
  const leadHeroCrop = parseImageCrop(event.leadCaptureHeroCrop) || parseImageCrop(event.bannerCrop);
  const error = typeof query.error === "string" ? query.error : null;
  const headline = event.leadCaptureHeadline || event.title;
  const description =
    event.leadCaptureDescription ||
    event.subtitle ||
    "Cadastre-se para receber as informações do evento, prioridade de abertura e o link do grupo oficial.";
  const offerText =
    event.leadCaptureOfferText || "Entre na lista e receba condições especiais na abertura das vendas.";
  const ctaText = event.leadCaptureCtaText || "Garantir meu super desconto";
  const youtubeEmbedUrl = getYoutubeEmbedUrl(event.leadCaptureVideoUrl);
  const tracking = getTrackingParamsFromSearch(query, `/lista/${event.slug}`);

  return (
    <main className="shell leadCaptureShell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href="/">Eventos</Link>
        </nav>
      </header>

      <section className="leadCaptureHero">
        <div className={`leadCaptureHeroMedia ${leadHeroCrop ? "hasCrop" : ""}`}>
          <img
            className={leadHeroCrop ? "croppedImage" : ""}
            alt={headline}
            src={heroImage}
            style={imageCropStyle(leadHeroCrop)}
          />
        </div>
        <div className="leadCaptureHeroContent">
          <span className="leadEyebrow">Lista de interesse oficial</span>
          <h1>{headline}</h1>
          <p>{description}</p>
          <div className="leadCaptureMeta">
            <span>{formatDateTime(event.startsAt)}</span>
            <span>
              {event.city}, {event.state}
            </span>
          </div>
          <div className="leadOfferBox">
            <strong>{offerText}</strong>
            <small>Cadastre-se e siga para a página final com o grupo oficial do WhatsApp.</small>
          </div>
          <div className="leadBenefitRow" aria-label="Benefícios da lista de interesse">
            <span>Lista oficial</span>
            <span>Prioridade na abertura</span>
            <span>Grupo no WhatsApp</span>
          </div>
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
            <h2>Garanta sua prioridade</h2>
            <p className="muted">
              Preencha seus dados para entrar na lista de interesse e receber a abertura deste evento.
            </p>
            {error ? <div className="errorBox">{error}</div> : null}
            <label className="field">
              <span>Nome</span>
              <input name="name" placeholder="Seu nome completo" required />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input name="email" type="email" placeholder="Digite seu melhor e-mail" required />
            </label>
            <label className="field">
              <span>DDD + Celular</span>
              <input name="phone" inputMode="tel" placeholder="DDD + Celular" required />
            </label>
            <SubmitButton className="button fullButton" pendingText="Enviando cadastro...">
              {ctaText}
            </SubmitButton>
            <small className="leadCaptureFootnote">
              Seus dados serão usados apenas para avisos deste lançamento e acesso ao grupo oficial.
            </small>
          </form>
        </div>
      </section>

      <section className="leadCaptureBody">
        <article className="leadCaptureSection card">
          <div className="sectionHeader">
            <div>
              <span className="leadEyebrow">Como funciona</span>
              <h2>Entre na lista antes da abertura oficial</h2>
            </div>
          </div>
          <div className="leadStepsGrid">
            <article className="leadStepCard">
              <strong>1. Cadastre seus dados</strong>
              <p>Leva poucos segundos. Você entra na lista oficial deste lançamento.</p>
            </article>
            <article className="leadStepCard">
              <strong>2. Acesse o grupo no WhatsApp</strong>
              <p>É por lá que vamos concentrar avisos, abertura e condições especiais.</p>
            </article>
            <article className="leadStepCard">
              <strong>3. Receba prioridade na abertura</strong>
              <p>Quem estiver no grupo acompanha primeiro a liberação dos ingressos.</p>
            </article>
          </div>
        </article>

        {youtubeEmbedUrl ? (
          <section className="leadCaptureSection card leadVideoSection">
            <div className="sectionHeader">
              <div>
                <span className="leadEyebrow">Convite em vídeo</span>
                <h2>Assista antes de entrar na lista</h2>
              </div>
            </div>
            <p className="muted">
              Separamos um vídeo opcional para apresentar melhor a proposta deste evento e aumentar a intenção de compra.
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

        <section className="leadCaptureSection leadCaptureSectionSplit">
          <article className="card leadCaptureHighlight">
            <span className="leadEyebrow">O que você vai receber</span>
            <h2>Uma comunicação mais organizada e direta</h2>
            <p>
              A landing de captação existe para separar o interesse da compra. Primeiro você registra a intenção, entra no grupo e
              acompanha o lançamento. Depois, quando a venda abrir, seguimos para a página oficial de ingressos.
            </p>
            <ul className="leadChecklist">
              <li>aviso de abertura com antecedência</li>
              <li>acesso ao grupo oficial deste evento</li>
              <li>melhor contexto antes de tomar a decisão de compra</li>
            </ul>
          </article>

          <article className="card leadCaptureSupportCard">
            <span className="leadEyebrow">Convite rápido</span>
            <h2>Quer garantir prioridade neste lançamento?</h2>
            <p>Preencha o formulário no topo e siga para a próxima etapa. O processo foi pensado para ser rápido, leve e direto.</p>
            <a className="secondaryButton" href="#lead-capture-form">
              Ir para o formulário
            </a>
          </article>
        </section>
      </section>
    </main>
  );
}
