"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

type ShowcaseEvent = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date | string;
  venueName: string;
  city: string;
  state: string;
  bannerUrl: string | null;
  lots: Array<{
    priceInCents: number;
  }>;
};

type HomeEventCarouselProps = {
  events: ShowcaseEvent[];
  trackingQuery?: string;
};

const carouselAutoRotationMs = 4000;

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 20C12 20 18 14.6 18 10.2C18 6.78 15.31 4 12 4C8.69 4 6 6.78 6 10.2C6 14.6 12 20 12 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10.2" r="2.35" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M8 6L14 12L8 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function formatEventDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  // Server and browser must render the same event-local date during hydration.
  const timeZone = "America/Sao_Paulo";
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const hour = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone }).format(date);

  return `${day} ${month} • ${weekday} ${hour}H`;
}

function formatPrice(valueInCents?: number) {
  if (!valueInCents || valueInCents <= 0) {
    return "Em breve";
  }

  return `A partir de ${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100)}`;
}

export function HomeEventCarousel({ events, trackingQuery }: HomeEventCarouselProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const autoRotationIntervalRef = useRef<number | null>(null);
  const pausedRef = useRef(new Set<string>());
  const hasCarouselControls = events.length > 1;

  const scrollRail = useCallback((direction: "prev" | "next") => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;

    if (maxScrollLeft <= 0) {
      return;
    }

    const cards = Array.from(rail.querySelectorAll<HTMLElement>(".tcrEventCard"));
    const origin = cards[0]?.offsetLeft ?? 0;
    const positions = [...new Set(cards.map(card => Math.min(card.offsetLeft - origin, maxScrollLeft)))];
    const nearest = positions.reduce((best, position, index) =>
      Math.abs(position - rail.scrollLeft) < Math.abs(positions[best] - rail.scrollLeft) ? index : best, 0);
    const next = (nearest + (direction === "next" ? 1 : -1) + positions.length) % positions.length;
    rail.scrollTo({ left: positions[next] ?? 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(next - nearest) > 1 ? "instant" : "smooth" });
  }, []);

  const startAutoRotation = useCallback(() => {
    if (autoRotationIntervalRef.current !== null) {
      window.clearInterval(autoRotationIntervalRef.current);
      autoRotationIntervalRef.current = null;
    }

    if (!hasCarouselControls) {
      return;
    }

    autoRotationIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible" && pausedRef.current.size === 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) scrollRail("next");
    }, carouselAutoRotationMs);
  }, [hasCarouselControls, scrollRail]);

  const navigateManually = useCallback(
    (direction: "prev" | "next") => {
      scrollRail(direction);
      startAutoRotation();
    },
    [scrollRail, startAutoRotation]
  );

  useEffect(() => {
    startAutoRotation();

    return () => {
      if (autoRotationIntervalRef.current !== null) {
        window.clearInterval(autoRotationIntervalRef.current);
      }
    };
  }, [startAutoRotation]);

  if (events.length === 0) {
    return (
      <article className="tcrEmptyState">
        <h3>Nenhum evento em cartaz no momento</h3>
        <p>Assim que a agenda for publicada, os próximos eventos aparecem aqui automaticamente.</p>
      </article>
    );
  }

  return (
    <div className={`tcrCarouselShell ${hasCarouselControls ? "hasCarouselControls" : "isSingleCarousel"}`}
      onPointerEnter={event => { if (event.pointerType === "mouse") pausedRef.current.add("hover"); }}
      onPointerLeave={() => { pausedRef.current.delete("hover"); pausedRef.current.delete("pointer"); startAutoRotation(); }}
      onPointerDown={() => pausedRef.current.add("pointer")}
      onPointerUp={() => { pausedRef.current.delete("pointer"); startAutoRotation(); }}
      onPointerCancel={() => { pausedRef.current.delete("pointer"); startAutoRotation(); }}
      onFocusCapture={() => pausedRef.current.add("focus")}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { pausedRef.current.delete("focus"); startAutoRotation(); } }}
    >
      {hasCarouselControls ? (
        <button aria-label="Eventos anteriores" className="tcrCarouselArrow tcrCarouselArrowPrev" onClick={() => navigateManually("prev")} type="button">
          ‹
        </button>
      ) : null}
      <div className="tcrCarouselRail" ref={railRef}>
        {events.map((event) => (
          <article className="tcrEventCard" key={event.id}>
            <div className="tcrEventCardMedia">
              {event.bannerUrl ? <img className="tcrEventCardBackdrop" src={event.bannerUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
              <img
                src={event.bannerUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80"}
                alt={`Banner de ${event.title}`}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="tcrEventCardBody">
              <small>{formatEventDate(event.startsAt)}</small>
              <h3>{event.title}</h3>
              <p className="tcrEventCardLocation">
                <PinIcon />
                {event.city}, {event.state}
              </p>
              <strong>{formatPrice(event.lots[0]?.priceInCents)}</strong>
              <Link className="tcrEventCardButton" href={`/evento/${event.slug}${trackingQuery ? `?${trackingQuery}` : ""}`}>
                <span>Ver ingressos</span>
                <ArrowIcon />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {hasCarouselControls ? (
        <button aria-label="Próximos eventos" className="tcrCarouselArrow tcrCarouselArrowNext" onClick={() => navigateManually("next")} type="button">
          ›
        </button>
      ) : null}
    </div>
  );
}
