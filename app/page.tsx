import Link from "next/link";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";

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
  const events = await listCachedPublishedEventShowcase(6);
  const featuredEvent = events[0] ?? null;

  return (
    <main className="shell homePage">
      <section className="homeHero">
        <div className="homeHeroInner">
          <div className="homeHeroContent">
            <div className="brand homeBrand" aria-label="TCR Ingressos">
              <span className="brandMark">T</span>
              <span>TCR Ingressos</span>
            </div>
            <span className="homeEyebrow">Bilheteria oficial</span>
            <h1>Eventos em cartaz com compra segura, operação rápida e experiência profissional.</h1>
            <p>
              Encontre os próximos eventos da TCR, escolha seu ingresso em poucos passos e receba o
              QR Code automaticamente após a confirmação do pagamento.
            </p>
            <div className="homeTrustStrip" aria-label="Diferenciais da bilheteria">
              {trustHighlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="homeHeroStats" aria-label="Indicadores da plataforma">
              <div>
                <span>Eventos</span>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span>Fluxo</span>
                <strong>Compra e check-in</strong>
              </div>
              <div>
                <span>Pagamento</span>
                <strong>Pix e cartão</strong>
              </div>
            </div>
          </div>

          <aside className="homeFeaturePanel" aria-label="Evento em destaque">
            {featuredEvent ? (
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
                  <span>Painel pronto</span>
                  <strong>Publique seu próximo evento</strong>
                  <p>
                    Assim que houver um evento publicado, ele aparece aqui com destaque para impulsionar
                    a próxima venda.
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
              <span className="eyebrow">Agenda aberta</span>
              <h2>Confira os próximos eventos disponíveis</h2>
            </div>
          </div>

          <div className="homeEventsLayout">
            <div className="grid cardsGrid homeCardsGrid">
              {events.length === 0 ? (
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
              <span className="eyebrow">Compra assistida</span>
              <h3>Do pedido ao QR Code, tudo em um só lugar.</h3>
              <p>
                A vitrine pública mostra os eventos em cartaz, enquanto o painel interno mantém a
                operação organizada para vendas, ingressos e check-in.
              </p>
              <div className="homeSupportList">
                {operationalHighlights.map((item) => (
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
