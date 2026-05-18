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
};

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

function formatEventDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const hour = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false }).format(date);

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

export function HomeEventCarousel({ events }: HomeEventCarouselProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
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

    const firstCard = rail.querySelector<HTMLElement>(".tcrEventCard");
    const railStyles = window.getComputedStyle(rail);
    const gap = Number.parseFloat(railStyles.columnGap || railStyles.gap || "0") || 0;
    const step = firstCard
      ? firstCard.getBoundingClientRect().width + gap
      : Math.max(rail.clientWidth * 0.82, 280);
    const tolerance = 8;
    const isAtStart = rail.scrollLeft <= tolerance;
    const isAtEnd = rail.scrollLeft >= maxScrollLeft - tolerance;
    const target =
      direction === "next"
        ? isAtEnd
          ? 0
          : Math.min(rail.scrollLeft + step, maxScrollLeft)
        : isAtStart
          ? maxScrollLeft
          : Math.max(rail.scrollLeft - step, 0);

    rail.scrollTo({
      left: target,
      behavior: "smooth"
    });
  }, []);

  useEffect(() => {
    if (!hasCarouselControls) {
      return;
    }

    const intervalId = window.setInterval(() => {
      scrollRail("next");
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasCarouselControls, scrollRail]);

  if (events.length === 0) {
    return (
      <article className="tcrEmptyState">
        <h3>Nenhum evento em cartaz no momento</h3>
        <p>Assim que a agenda for publicada, os próximos eventos aparecem aqui automaticamente.</p>
      </article>
    );
  }

  return (
    <div className={`tcrCarouselShell ${hasCarouselControls ? "hasCarouselControls" : "isSingleCarousel"}`}>
      {hasCarouselControls ? (
        <button aria-label="Eventos anteriores" className="tcrCarouselArrow tcrCarouselArrowPrev" onClick={() => scrollRail("prev")} type="button">
          ‹
        </button>
      ) : null}
      <div className="tcrCarouselRail" ref={railRef}>
        {events.map((event) => (
          <article className="tcrEventCard" key={event.id}>
            <div
              className="tcrEventCardMedia"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(6, 20, 24, 0.02), rgba(6, 20, 24, 0.24)), url("${event.bannerUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80"}")`
              }}
            />
            <div className="tcrEventCardBody">
              <small>{formatEventDate(event.startsAt)}</small>
              <h3>{event.title}</h3>
              <p className="tcrEventCardLocation">
                <PinIcon />
                {event.city}, {event.state}
              </p>
              <strong>{formatPrice(event.lots[0]?.priceInCents)}</strong>
              <Link className="tcrEventCardButton" href={`/evento/${event.slug}`}>
                <span>Ver ingressos</span>
                <ArrowIcon />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {hasCarouselControls ? (
        <button aria-label="Próximos eventos" className="tcrCarouselArrow tcrCarouselArrowNext" onClick={() => scrollRail("next")} type="button">
          ›
        </button>
      ) : null}
    </div>
  );
}
