import Link from "next/link";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

function formatEventCardDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const trustHighlights = ["Pix e cartão", "QR Code automático", "Check-in seguro"];

const operationalHighlights = [
  "Página pública com foco em conversão",
  "Pedidos, pagamentos e ingressos no mesmo fluxo",
  "Painel administrativo para operação diária"
];

export default async function Home() {
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const events = await listCachedPublishedEventShowcase(6, organizationContext.organization.id);
  const featuredEvent = events[0] ?? null;

  return (
    <main className="shell homePage">
      <section className="homeHero">
        <div className="homeHeroInner">
          <div className="homeHeroContent">
            <div
              className="brand homeBrand"
              aria-label={isPlatformHost ? organizationContext.platformName : organizationContext.brandName}
            >
              <span className="brandMark">{organizationContext.brandMark}</span>
              <span>{isPlatformHost ? organizationContext.platformName : organizationContext.brandName}</span>
            </div>
            <span className="homeEyebrow">{isPlatformHost ? "Plataforma SaaS de bilheteria" : "Bilheteria oficial"}</span>
            <h1>
              {isPlatformHost
                ? "A base para operar várias bilheterias com domínio e identidade próprios."
                : "Eventos em cartaz com compra segura, operação rápida e experiência profissional."}
            </h1>
            <p>
              {isPlatformHost
                ? `${organizationContext.platformName} é a plataforma-mãe que sustenta bilheterias como a ${organizationContext.brandName} e futuras operações com eventos, leads, pedidos, ingressos e check-in no mesmo motor.`
                : `Encontre os próximos eventos da ${organizationContext.brandName}, escolha seu ingresso em poucos passos e receba o QR Code automaticamente após a confirmação do pagamento.`}
            </p>
            <div className="homeTrustStrip" aria-label="Diferenciais da bilheteria">
              {(isPlatformHost
                ? ["Domínio por operação", "Pagamento e QR Code", "Painel para produtores"]
                : trustHighlights
              ).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="homeHeroStats" aria-label="Indicadores da plataforma">
              <div>
                <span>{isPlatformHost ? "Operações prontas" : "Eventos"}</span>
                <strong>{isPlatformHost ? "1 base ativa" : events.length}</strong>
              </div>
              <div>
                <span>Fluxo</span>
                <strong>{isPlatformHost ? "SaaS + operação" : "Compra e check-in"}</strong>
              </div>
              <div>
                <span>{isPlatformHost ? "Modelo" : "Pagamento"}</span>
                <strong>{isPlatformHost ? "Bilheteria white-label" : "Pix e cartão"}</strong>
              </div>
            </div>
          </div>

          <aside className="homeFeaturePanel" aria-label="Evento em destaque">
            {!isPlatformHost && featuredEvent ? (
              <article className="homeFeaturedEventCard">
                <div
                  className="homeFeaturedEventMedia"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(13, 23, 31, 0.08), rgba(13, 23, 31, 0.34)), url("${featuredEvent.bannerUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1600&q=80"}")`
                  }}
                />
                <div className="homeFeaturedEventBody">
                  <span className="eyebrow">Em destaque</span>
                  <h2>{featuredEvent.title}</h2>
                  <p>
                    {formatEventCardDate(featuredEvent.startsAt)} • {featuredEvent.city}, {featuredEvent.state}
                  </p>
                  <strong>{featuredEvent.venueName}</strong>
                  <Link className="button fullButton" href={`/evento/${featuredEvent.slug}`}>
                    Comprar agora
                  </Link>
                </div>
              </article>
            ) : (
              <div className="homeFeatureCard">
                <div>
                  <span>{isPlatformHost ? "Ingressas" : "Painel pronto"}</span>
                  <strong>{isPlatformHost ? "Estruture uma nova operação na plataforma" : "Publique seu próximo evento"}</strong>
                  <p>
                    {isPlatformHost
                      ? "O próximo passo é cadastrar as operações filhas, apontar seus domínios e isolar marca, usuários, eventos e vendas."
                      : "Assim que houver um evento publicado, ele aparece aqui com destaque para impulsionar a próxima venda."}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="homeEventsBand">
        <div className="container homeEventsContainer">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">{isPlatformHost ? "Próximas operações" : "Agenda aberta"}</span>
              <h2>
                {isPlatformHost
                  ? "A estrutura já está pronta para crescer além da TCR"
                  : "Confira os próximos eventos disponíveis"}
              </h2>
            </div>
          </div>

          <div className="homeEventsLayout">
            <div className="grid cardsGrid homeCardsGrid">
              {isPlatformHost ? (
                <>
                  <article className="card homeEmptyState">
                    <h3>TCR Ingressos</h3>
                    <p className="muted">
                      Primeira operação da base, já com eventos, pedidos, ingressos, check-in e captação.
                    </p>
                  </article>
                  <article className="card homeEmptyState">
                    <h3>Próxima bilheteria</h3>
                    <p className="muted">
                      O próximo passo técnico é cadastrar a segunda operação e apontar o domínio próprio dela.
                    </p>
                  </article>
                </>
              ) : events.length === 0 ? (
                <article className="card homeEmptyState">
                  <h3>Nenhum evento publicado ainda</h3>
                  <p className="muted">
                    Assim que um evento for publicado no painel, ele aparecerá automaticamente nesta
                    vitrine pública.
                  </p>
                </article>
              ) : (
                events.map((event) => (
                  <article className="card linkCard eventShowcaseCard" key={event.id}>
                    <div
                      className="eventShowcaseImage"
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(8, 20, 29, 0.06), rgba(8, 20, 29, 0.28)), url("${event.bannerUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1400&q=80"}")`
                      }}
                    />
                    <div className="eventShowcaseBody">
                      <span className="eyebrow">
                        {event.city}, {event.state}
                      </span>
                      <h3>{event.title}</h3>
                      <p className="muted">{formatEventCardDate(event.startsAt)}</p>
                      <strong>{event.venueName}</strong>
                      <Link className="button smallButton" href={`/evento/${event.slug}`}>
                        Comprar agora
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="homeSupportPanel">
              <span className="eyebrow">{isPlatformHost ? "Visão da plataforma" : "Compra assistida"}</span>
              <h3>
                {isPlatformHost
                  ? "Uma base única para várias bilheterias com identidades diferentes."
                  : "Do pedido ao QR Code, tudo em um só lugar."}
              </h3>
              <p>
                {isPlatformHost
                  ? `${organizationContext.platformName} administra o motor. Cada operação filha publica no seu próprio domínio e mantém branding, equipe e eventos separados.`
                  : "A vitrine pública mostra os eventos em cartaz, enquanto o painel interno mantém a operação organizada para vendas, ingressos e check-in."}
              </p>
              <div className="homeSupportList">
                {(isPlatformHost
                  ? [
                      "motor único para vendas, pagamentos e ingressos",
                      "domínio e identidade separados por operação",
                      "escala sem duplicar código nem banco"
                    ]
                  : operationalHighlights
                ).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
