import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { createEventLeadAction } from "@/features/leads/lead.actions";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { formatDateTime } from "@/lib/format";

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
  const error = typeof query.error === "string" ? query.error : null;
  const headline = event.leadCaptureHeadline || event.title;
  const description =
    event.leadCaptureDescription ||
    event.subtitle ||
    "Cadastre-se para receber as informações do evento, prioridade de abertura e o link do grupo oficial.";
  const offerText =
    event.leadCaptureOfferText || "Entre na lista e receba condições especiais na abertura das vendas.";
  const ctaText = event.leadCaptureCtaText || "Garantir meu super desconto";

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
        <div className="leadCaptureHeroMedia">
          <img alt={headline} src={heroImage} />
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
          <form action={createEventLeadAction} className="leadCaptureForm card">
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="eventSlug" value={event.slug} />
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
    </main>
  );
}
