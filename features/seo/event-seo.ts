import type { Event } from "@prisma/client";
import { BRAZIL_TIME_ZONE } from "@/lib/format";

type EventSeoInput = Pick<
  Event,
  | "title"
  | "subtitle"
  | "description"
  | "startsAt"
  | "venueName"
  | "city"
  | "state"
  | "bannerUrl"
  | "slug"
  | "seoTitle"
  | "seoDescription"
  | "seoKeywords"
  | "seoImageUrl"
>;

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatEventDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: BRAZIL_TIME_ZONE
  }).format(value);
}

export function buildEventSeo(event: EventSeoInput) {
  const date = formatEventDate(event.startsAt);
  const location = `${event.venueName}, ${event.city}-${event.state}`;
  const automaticTitle = compactText(`${event.title} | Ingressos TCR Ingressos`, 58);
  const automaticDescription = compactText(
    `${event.subtitle ? `${event.subtitle}. ` : ""}Compre ingressos para ${event.title} em ${date}, no ${location}. ${event.description}`,
    155
  );
  const keywords = event.seoKeywords
    ? event.seoKeywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [
        event.title,
        "ingressos",
        "TCR Ingressos",
        event.city,
        event.state,
        event.venueName
      ].filter(Boolean);

  return {
    title: event.seoTitle ? compactText(event.seoTitle, 70) : automaticTitle,
    description: event.seoDescription ? compactText(event.seoDescription, 180) : automaticDescription,
    image: event.seoImageUrl || event.bannerUrl || null,
    keywords,
    canonicalPath: `/evento/${event.slug}`
  };
}
