import Link from "next/link";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

export default async function Home() {
  const events = await listCachedPublishedEventShowcase(6);

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
            <h1>Eventos em cartaz com compra segura e ingresso digital.</h1>
            <p>
              Confira as próximas experiências da TCR, escolha seu ingresso e receba o QR Code para
              entrada de forma automática após a confirmação do pagamento.
            </p>
            <div className="homeTrustStrip" aria-label="Diferenciais da TCR Ingressos">
              <span>Pix e cartão</span>
              <span>QR Code automático</span>
              <span>Site oficial</span>
            </div>
            <div className="homeHeroStatement">
              <strong>Escolha o evento, garanta seu ingresso e acompanhe tudo pelo pedido.</strong>
              <span>Uma jornada simples para quem compra e segura para quem opera.</span>
            </div>
          </div>

          <aside className="homeFeaturePanel" aria-label="Evento em destaque">
            {events[0] ? (
              <Link className="homeFeatureCard" href={`/evento/${events[0].slug}`}>
                {events[0].bannerUrl ? <img src={events[0].bannerUrl} alt="" /> : null}
                <div>
                  <span>Em destaque</span>
                  <strong>{events[0].title}</strong>
                  <p>{formatDateTime(events[0].startsAt)} · {events[0].venueName}</p>
                </div>
              </Link>
            ) : (
              <div className="homeFeatureCard emptyFeature">
                <span>Agenda TCR</span>
                <strong>Novos eventos em breve</strong>
                <p>Acompanhe a bilheteria oficial para ver as próximas aberturas.</p>
              </div>
            )}
            <div className="homeMiniStats">
              <div>
                <span>Eventos</span>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span>Compra</span>
                <strong>Segura</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="homeEventsBand">
        <div className="container homeEventsContainer">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">Agenda aberta</span>
              <h2>Confira os eventos disponíveis</h2>
            </div>
          </div>

          <div className="homeEventsLayout">
            {events.length === 0 ? (
              <div className="empty homeEmptyState">Nenhum evento publicado no momento.</div>
            ) : (
              <div className="grid cardsGrid homeCardsGrid">
                {events.map((event) => (
                  <Link className="card linkCard eventShowcaseCard" href={`/evento/${event.slug}`} key={event.id}>
                    {event.bannerUrl ? <img src={event.bannerUrl} alt="" /> : null}
                    <div className="eventShowcaseBody">
                      <span className="eyebrow">{event.city}, {event.state}</span>
                      <h3>{event.title}</h3>
                      <p className="muted">{formatDateTime(event.startsAt)} · {event.venueName}</p>
                      <span className="eventCardCta">Comprar agora</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <aside className="homeSupportPanel">
              <span className="eyebrow">Compra assistida</span>
              <h3>Do pedido ao QR Code, tudo em um só lugar.</h3>
              <p>
                Acompanhe o status do pedido, receba seu ingresso digital e apresente o QR Code na entrada
                do evento.
              </p>
              <div className="homeSupportList">
                <span>Pagamento confirmado automaticamente</span>
                <span>Ingresso enviado por e-mail</span>
                <span>Validação segura na portaria</span>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
