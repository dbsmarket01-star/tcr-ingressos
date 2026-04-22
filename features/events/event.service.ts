import { EventStatus, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ensureDefaultOrganizationBackfill } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import type { EventDraftInput } from "./event.schema";

export type EventListItem = Awaited<ReturnType<typeof listEvents>>[number];
export type EventManagement = NonNullable<Awaited<ReturnType<typeof getEventForManagement>>>;

export async function listEvents(organizationId: string, allowedEventIds?: string[] | null) {
  return prisma.event.findMany({
    where: {
      organizationId,
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    include: {
      lots: {
        select: {
          totalQuantity: true,
          soldQuantity: true,
          reservedQuantity: true
        }
      },
      orders: {
        where: {
          status: "PAID"
        },
        select: {
          totalInCents: true
        }
      },
      coupons: {
        orderBy: {
          createdAt: "desc"
        }
      },
      _count: {
        select: {
          leads: true
        }
      }
    }
  });
}

export async function listPublishedEventShowcase(limit = 6) {
  const organizationId = await ensureDefaultOrganizationBackfill();
  return prisma.event.findMany({
    where: {
      organizationId,
      status: EventStatus.PUBLISHED
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      venueName: true,
      city: true,
      state: true,
      bannerUrl: true
    }
  });
}

const listCachedPublishedEventShowcaseRaw = unstable_cache(listPublishedEventShowcase, ["published-event-showcase"], {
  revalidate: 30
});

export async function listCachedPublishedEventShowcase(limit = 6) {
  const events = await listCachedPublishedEventShowcaseRaw(limit);
  return events.map((event) => normalizeCachedEventDates(event));
}

export async function createEvent(input: EventDraftInput & { status: EventStatus }, organizationId: string) {
  const data: Prisma.EventCreateInput = {
    organization: {
      connect: {
        id: organizationId
      }
    },
    title: input.title,
    slug: input.slug,
    subtitle: input.subtitle || null,
    description: input.description || "",
    bannerUrl: input.bannerUrl || null,
    bannerPosition: input.bannerPosition,
    bannerCrop: input.bannerCrop || null,
    eventMapImageUrl: input.eventMapImageUrl || null,
    eventMapCrop: input.eventMapCrop || null,
    eventMapTemplate: input.eventMapTemplate,
    eventMapNotes: input.eventMapNotes || null,
    startsAt: input.startsAt,
    endsAt: input.endsAt || null,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    city: input.city,
    state: input.state.toUpperCase(),
    status: input.status,
    salesStartsAt: input.salesStartsAt || null,
    salesEndsAt: input.salesEndsAt || null,
    importantInfo: input.importantInfo || null,
    metaPixelId: input.metaPixelId || null,
    googleTagManagerId: input.googleTagManagerId || null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    seoKeywords: input.seoKeywords || null,
    seoImageUrl: input.seoImageUrl || null,
    supportWhatsappUrl: input.supportWhatsappUrl || null,
    leadCaptureEnabled: input.leadCaptureEnabled,
    leadCaptureHeadline: input.leadCaptureHeadline || null,
    leadCaptureDescription: input.leadCaptureDescription || null,
    leadCaptureOfferText: input.leadCaptureOfferText || null,
    leadCaptureCtaText: input.leadCaptureCtaText || null,
    leadCaptureHeroImageUrl: input.leadCaptureHeroImageUrl || null,
    leadCaptureHeroCrop: input.leadCaptureHeroCrop || null,
    leadCaptureVideoUrl: input.leadCaptureVideoUrl || null,
    leadCaptureWhatsappGroupUrl: input.leadCaptureWhatsappGroupUrl || null,
    leadCaptureThankYouTitle: input.leadCaptureThankYouTitle || null,
    leadCaptureThankYouDescription: input.leadCaptureThankYouDescription || null,
    leadCaptureThankYouButtonText: input.leadCaptureThankYouButtonText || null,
    conversionSocialProofText: input.conversionSocialProofText || null,
    conversionUrgencyText: input.conversionUrgencyText || null,
    conversionCtaText: input.conversionCtaText || null,
    highlightedLotId: input.highlightedLotId || null
  };

  return prisma.event.create({ data });
}

export async function getEventForManagement(
  eventId: string,
  organizationId: string,
  allowedEventIds?: string[] | null
) {
  return prisma.event.findFirst({
    where: {
      AND: [
        { id: eventId },
        { organizationId },
        ...(allowedEventIds ? [{ id: { in: allowedEventIds } }] : [])
      ]
    },
    include: {
      lots: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      leads: {
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      },
      _count: {
        select: {
          leads: true
        }
      },
      orders: {
        where: {
          status: "PAID"
        },
        select: {
          totalInCents: true
        }
      },
      coupons: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
}

export async function getPublicEventBySlug(slug: string) {
  const organizationId = await ensureDefaultOrganizationBackfill();
  return prisma.event.findFirst({
    where: {
      organizationId,
      slug,
      status: "PUBLISHED"
    },
    include: {
      lots: {
        where: {
          status: "ACTIVE"
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });
}

export async function getEventSeoBySlug(slug: string) {
  const organizationId = await ensureDefaultOrganizationBackfill();
  return prisma.event.findFirst({
    where: {
      organizationId,
      slug,
      status: "PUBLISHED"
    }
  });
}

function toDate(value: unknown) {
  return value instanceof Date ? value : typeof value === "string" ? new Date(value) : value;
}

function normalizeCachedEventDates<T>(event: T): T {
  if (!event || typeof event !== "object") {
    return event;
  }

  const normalized = event as Record<string, unknown>;

  for (const field of ["startsAt", "endsAt", "salesStartsAt", "salesEndsAt", "createdAt", "updatedAt"]) {
    if (field in normalized && normalized[field]) {
      normalized[field] = toDate(normalized[field]);
    }
  }

  if (Array.isArray(normalized.lots)) {
    normalized.lots = normalized.lots.map((lot) => normalizeCachedEventDates(lot));
  }

  return normalized as T;
}

const getCachedPublicEventBySlugRaw = unstable_cache(getPublicEventBySlug, ["public-event"], {
  revalidate: 10
});

const getCachedEventSeoBySlugRaw = unstable_cache(getEventSeoBySlug, ["public-event-seo"], {
  revalidate: 60
});

export async function getCachedPublicEventBySlug(slug: string) {
  return normalizeCachedEventDates(await getCachedPublicEventBySlugRaw(slug));
}

export async function getCachedEventSeoBySlug(slug: string) {
  return normalizeCachedEventDates(await getCachedEventSeoBySlugRaw(slug));
}

export async function updateEvent(eventId: string, input: EventDraftInput & { status: EventStatus }) {
  const data: Prisma.EventUpdateInput = {
    title: input.title,
    slug: input.slug,
    subtitle: input.subtitle || null,
    description: input.description || "",
    bannerUrl: input.bannerUrl || null,
    bannerPosition: input.bannerPosition,
    bannerCrop: input.bannerCrop || null,
    eventMapImageUrl: input.eventMapImageUrl || null,
    eventMapCrop: input.eventMapCrop || null,
    eventMapTemplate: input.eventMapTemplate,
    eventMapNotes: input.eventMapNotes || null,
    startsAt: input.startsAt,
    endsAt: input.endsAt || null,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    city: input.city,
    state: input.state.toUpperCase(),
    status: input.status,
    salesStartsAt: input.salesStartsAt || null,
    salesEndsAt: input.salesEndsAt || null,
    importantInfo: input.importantInfo || null,
    metaPixelId: input.metaPixelId || null,
    googleTagManagerId: input.googleTagManagerId || null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    seoKeywords: input.seoKeywords || null,
    seoImageUrl: input.seoImageUrl || null,
    supportWhatsappUrl: input.supportWhatsappUrl || null,
    leadCaptureEnabled: input.leadCaptureEnabled,
    leadCaptureHeadline: input.leadCaptureHeadline || null,
    leadCaptureDescription: input.leadCaptureDescription || null,
    leadCaptureOfferText: input.leadCaptureOfferText || null,
    leadCaptureCtaText: input.leadCaptureCtaText || null,
    leadCaptureHeroImageUrl: input.leadCaptureHeroImageUrl || null,
    leadCaptureHeroCrop: input.leadCaptureHeroCrop || null,
    leadCaptureVideoUrl: input.leadCaptureVideoUrl || null,
    leadCaptureWhatsappGroupUrl: input.leadCaptureWhatsappGroupUrl || null,
    leadCaptureThankYouTitle: input.leadCaptureThankYouTitle || null,
    leadCaptureThankYouDescription: input.leadCaptureThankYouDescription || null,
    leadCaptureThankYouButtonText: input.leadCaptureThankYouButtonText || null,
    conversionSocialProofText: input.conversionSocialProofText || null,
    conversionUrgencyText: input.conversionUrgencyText || null,
    conversionCtaText: input.conversionCtaText || null,
    highlightedLotId: input.highlightedLotId || null
  };

  return prisma.event.update({
    where: { id: eventId },
    data
  });
}

export async function updateEventStatus(eventId: string, status: EventStatus) {
  return prisma.event.update({
    where: { id: eventId },
    data: { status }
  });
}

function createDuplicateSlug(baseSlug: string) {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${baseSlug}-copia-${suffix}`;
}

export async function duplicateEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      lots: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!event) {
    throw new Error("Evento nao encontrado para duplicar.");
  }

  return prisma.$transaction(async (tx) => {
    const duplicatedEvent = await tx.event.create({
      data: {
        organizationId: event.organizationId,
        title: `Copia de ${event.title}`,
        slug: createDuplicateSlug(event.slug),
        subtitle: event.subtitle,
        description: event.description,
        bannerUrl: event.bannerUrl,
        bannerPosition: event.bannerPosition,
        bannerCrop: event.bannerCrop,
        eventMapImageUrl: event.eventMapImageUrl,
        eventMapCrop: event.eventMapCrop,
        eventMapTemplate: event.eventMapTemplate,
        eventMapNotes: event.eventMapNotes,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        city: event.city,
        state: event.state,
        status: EventStatus.DRAFT,
        salesStartsAt: event.salesStartsAt,
        salesEndsAt: event.salesEndsAt,
        importantInfo: event.importantInfo,
        metaPixelId: event.metaPixelId,
        googleTagManagerId: event.googleTagManagerId,
        seoTitle: event.seoTitle,
        seoDescription: event.seoDescription,
        seoKeywords: event.seoKeywords,
        seoImageUrl: event.seoImageUrl,
        supportWhatsappUrl: event.supportWhatsappUrl,
        leadCaptureEnabled: event.leadCaptureEnabled,
        leadCaptureHeadline: event.leadCaptureHeadline,
        leadCaptureDescription: event.leadCaptureDescription,
        leadCaptureOfferText: event.leadCaptureOfferText,
        leadCaptureCtaText: event.leadCaptureCtaText,
        leadCaptureHeroImageUrl: event.leadCaptureHeroImageUrl,
        leadCaptureHeroCrop: event.leadCaptureHeroCrop,
        leadCaptureVideoUrl: event.leadCaptureVideoUrl,
        leadCaptureWhatsappGroupUrl: event.leadCaptureWhatsappGroupUrl,
        leadCaptureThankYouTitle: event.leadCaptureThankYouTitle,
        leadCaptureThankYouDescription: event.leadCaptureThankYouDescription,
        leadCaptureThankYouButtonText: event.leadCaptureThankYouButtonText,
        conversionSocialProofText: event.conversionSocialProofText,
        conversionUrgencyText: event.conversionUrgencyText,
        conversionCtaText: event.conversionCtaText
      }
    });

    const lotIdMap = new Map<string, string>();

    for (const lot of event.lots) {
      const duplicatedLot = await tx.ticketLot.create({
        data: {
          eventId: duplicatedEvent.id,
          name: lot.name,
          description: lot.description,
          priceInCents: lot.priceInCents,
          serviceFeeBps: lot.serviceFeeBps,
          cardInterestBpsPerInstallment: lot.cardInterestBpsPerInstallment,
          cardInterestStartsAtInstallment: lot.cardInterestStartsAtInstallment,
          totalQuantity: lot.totalQuantity,
          reservedQuantity: 0,
          soldQuantity: 0,
          minPerOrder: lot.minPerOrder,
          maxPerOrder: lot.maxPerOrder,
          salesStartsAt: lot.salesStartsAt,
          salesEndsAt: lot.salesEndsAt,
          sortOrder: lot.sortOrder,
          status: lot.status
        }
      });

      lotIdMap.set(lot.id, duplicatedLot.id);
    }

    const highlightedLotId = event.highlightedLotId ? lotIdMap.get(event.highlightedLotId) : null;

    if (highlightedLotId) {
      return tx.event.update({
        where: { id: duplicatedEvent.id },
        data: { highlightedLotId }
      });
    }

    return duplicatedEvent;
  });
}

export function getEventCapacity(event: Pick<EventListItem, "lots">) {
  return event.lots.reduce(
    (totals, lot) => ({
      sold: totals.sold + lot.soldQuantity,
      reserved: totals.reserved + lot.reservedQuantity,
      total: totals.total + lot.totalQuantity
    }),
    { sold: 0, reserved: 0, total: 0 }
  );
}

export function getEventRevenueInCents(event: Pick<EventListItem, "orders">) {
  return event.orders.reduce((sum, order) => sum + order.totalInCents, 0);
}
