import Link from "next/link";
import { listEvents } from "@/features/events/event.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const events = (await listEvents()).filter((event) => event.status === "PUBLISHED").slice(0, 6);

  return (
    <main className="shell">
      <section className="hero">
        <div className="heroInner">
          <div className="brand" aria-label="TCR Ingressos">
            <span className="brandMark">T</span>
            <span>TCR Ingressos</span>
          </div>
          <h1>TCR Ingressos</h1>
          <p>
            Bilheteria oficial para eventos da TCR. Compre com segurança, receba seu ingresso com QR Code
            e acompanhe tudo pelo seu pedido.
          </p>
          <div className="heroActions">
            {events[0] ? (
              <Link className="button" href={`/evento/${events[0].slug}`}>
                Ver evento em destaque
              </Link>
            ) : null}
            <Link className="secondaryButton" href="/login">
              Acesso interno
            </Link>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="sectionHeader">
          <div>
            <h2>Eventos disponíveis</h2>
            <p>Escolha um evento para ver informações, lotes e formas de pagamento.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="empty">Nenhum evento publicado no momento.</div>
        ) : (
          <div className="grid cardsGrid">
            {events.map((event) => (
              <Link className="card linkCard eventShowcaseCard" href={`/evento/${event.slug}`} key={event.id}>
                {event.bannerUrl ? <img src={event.bannerUrl} alt="" /> : null}
                <span className="eyebrow">{event.city}, {event.state}</span>
                <h3>{event.title}</h3>
                <p className="muted">{formatDateTime(event.startsAt)} · {event.venueName}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
