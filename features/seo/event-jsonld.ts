import type { Event, TicketLot } from "@prisma/client";

type PublicEvent = Pick<Event, "title" | "description" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "city" | "state" | "bannerUrl" | "seoImageUrl" | "createdAt">;
type PublicLot = Pick<TicketLot, "priceInCents" | "status" | "saleBadge" | "salesStartsAt" | "totalQuantity" | "soldQuantity" | "reservedQuantity">;

function brazilianIso(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    timeZoneName: "longOffset"
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset}`;
}

export function buildEventJsonLd(event: PublicEvent, lots: PublicLot[], canonicalUrl: string, organizerName: string, organizerUrl: string) {
  const available = lots.filter(lot => lot.status === "ACTIVE" && lot.saleBadge !== "SOLD_OUT" && lot.totalQuantity > lot.soldQuantity + lot.reservedQuantity);
  const lowest = available.reduce<PublicLot | null>((best, lot) => !best || lot.priceInCents < best.priceInCents ? lot : best, null);
  const image = event.seoImageUrl || event.bannerUrl;
  const artist = event.title.split(/\s+em\s+/iu)[0].trim();

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: brazilianIso(event.startsAt),
    ...(event.endsAt ? { endDate: brazilianIso(event.endsAt) } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venueAddress,
        addressLocality: event.city,
        addressRegion: event.state,
        addressCountry: "BR"
      }
    },
    ...(image ? { image: [new URL(image, organizerUrl).toString()] } : {}),
    description: event.description.replace(/\s+/gu, " ").trim(),
    ...(artist && artist !== event.title ? { performer: { "@type": "Person", name: artist } } : {}),
    organizer: { "@type": "Organization", name: organizerName, url: organizerUrl },
    ...(lowest ? { offers: {
      "@type": "Offer",
      url: canonicalUrl,
      price: (lowest.priceInCents / 100).toFixed(2),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      validFrom: brazilianIso(lowest.salesStartsAt || event.createdAt)
    } } : {})
  };
}
