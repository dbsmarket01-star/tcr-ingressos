import { EventStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getDefaultOrganizationId } from "@/features/organizations/organization.service";
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
      organization: {
        select: {
          publicDomain: true,
          adminDomain: true
        }
      },
      orders: {
        where: {
          status: "PAID",
          payment: {
            is: {
              status: "APPROVED"
            }
          }
        },
        select: {
          totalInCents: true,
          payment: {
            select: {
              amountInCents: true
            }
          }
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

export async function listPublishedEventShowcase(organizationId: string, limit = 6) {
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
      bannerUrl: true,
      lots: {
        where: {
          status: {
            in: ["ACTIVE", "SOLD_OUT"]
          }
        },
        orderBy: {
          priceInCents: "asc"
        },
        take: 1,
        select: {
          priceInCents: true
        }
      }
    }
  });
}

const listCachedPublishedEventShowcaseRaw = unstable_cache(listPublishedEventShowcase, ["published-event-showcase"], {
  revalidate: 30
});

export async function listCachedPublishedEventShowcase(limit = 6, organizationId?: string | null) {
  const resolvedOrganizationId = organizationId || (await getDefaultOrganizationId());
  const events = await listCachedPublishedEventShowcaseRaw(resolvedOrganizationId, limit);
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
    eventMapLayout: input.eventMapLayout as Prisma.InputJsonValue,
    googleMapsUrl: input.googleMapsUrl || null,
    doorsOpenAt: input.doorsOpenAt || null,
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
    metaConversionsApiToken: input.metaConversionsApiToken || null,
    metaTestEventCode: input.metaTestEventCode || null,
    googleTagManagerId: input.googleTagManagerId || null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    seoKeywords: input.seoKeywords || null,
    seoImageUrl: input.seoImageUrl || null,
    supportWhatsappUrl: input.supportWhatsappUrl || null,
    couponsEnabled: input.couponsEnabled,
    leadCaptureEnabled: input.leadCaptureEnabled,
    leadCaptureHeadline: input.leadCaptureHeadline || null,
    leadCaptureDescription: input.leadCaptureDescription || null,
    leadCaptureOfferText: input.leadCaptureOfferText || null,
    leadCaptureCtaText: input.leadCaptureCtaText || null,
    leadCaptureBadgeText: input.leadCaptureBadgeText || null,
    leadCaptureHeroSupportText: input.leadCaptureHeroSupportText || null,
    leadCaptureBenefitsText: input.leadCaptureBenefitsText || null,
    leadCaptureFormIntroEyebrow: input.leadCaptureFormIntroEyebrow || null,
    leadCaptureFormIntroTitle: input.leadCaptureFormIntroTitle || null,
    leadCaptureFormIntroDescription: input.leadCaptureFormIntroDescription || null,
    leadCaptureFormTimingText: input.leadCaptureFormTimingText || null,
    leadCaptureBonusText: input.leadCaptureBonusText || null,
    leadCaptureProofText: input.leadCaptureProofText || null,
    leadCaptureFooterStatsText: input.leadCaptureFooterStatsText || null,
    leadCaptureHeroImageUrl: input.leadCaptureHeroImageUrl || null,
    leadCaptureHeroCrop: input.leadCaptureHeroCrop || null,
    leadCaptureVenueGallery: input.leadCaptureVenueGallery || null,
    leadCaptureVideoUrl: input.leadCaptureVideoUrl || null,
    leadCaptureWhatsappGroupUrl: input.leadCaptureWhatsappGroupUrl || null,
    leadCaptureThankYouTitle: input.leadCaptureThankYouTitle || null,
    leadCaptureThankYouDescription: input.leadCaptureThankYouDescription || null,
    leadCaptureThankYouButtonText: input.leadCaptureThankYouButtonText || null,
    autoLeadCaptureEmailEnabled: input.autoLeadCaptureEmailEnabled,
    autoPurchaseApprovedEmailEnabled: input.autoPurchaseApprovedEmailEnabled,
    autoPendingPaymentEmailEnabled: input.autoPendingPaymentEmailEnabled,
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          },
          typeOptions: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      },
      organization: {
        select: {
          publicDomain: true,
          adminDomain: true
        }
      },
      leads: {
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          email: true,
          municipality: true,
          utmSource: true,
          utmMedium: true,
          thankYouViewedAt: true,
          whatsappClickedAt: true,
          whatsappClickCount: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          leads: true,
          checkIns: true
        }
      },
      orders: {
        where: {
          status: "PAID",
          payment: {
            is: {
              status: "APPROVED"
            }
          }
        },
        orderBy: {
          paidAt: "desc"
        },
        select: {
          code: true,
          createdAt: true,
          paidAt: true,
          status: true,
          totalInCents: true,
          customer: {
            select: {
              name: true,
              email: true
            }
          },
          items: {
            select: {
              quantity: true,
              lot: {
                select: {
                  name: true
                }
              }
            }
          },
          payment: {
            select: {
              status: true,
              provider: true,
              amountInCents: true
            }
          }
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

export async function listEventMapSources(
  organizationId: string,
  allowedEventIds?: string[] | null,
  excludeEventId?: string
) {
  return prisma.event.findMany({
    where: {
      organizationId,
      eventMapLayout: {
        not: Prisma.JsonNull
      },
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {}),
      ...(excludeEventId ? { id: { not: excludeEventId } } : {})
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      eventMapLayout: true
    },
    take: 40
  });
}

type DemographicOrder = {
  status: OrderStatus;
  buyerCity: string | null;
  buyerState: string | null;
  buyerNeighborhood: string | null;
  payment: {
    status: PaymentStatus;
  } | null;
};

function cleanLocationPart(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function buildCityLabel(order: DemographicOrder) {
  const city = cleanLocationPart(order.buyerCity);
  const state = cleanLocationPart(order.buyerState).toUpperCase();

  if (!city) {
    return "";
  }

  return state ? `${city}/${state}` : city;
}

function buildNeighborhoodLabel(order: DemographicOrder) {
  const neighborhood = cleanLocationPart(order.buyerNeighborhood);
  const cityLabel = buildCityLabel(order);

  if (!neighborhood) {
    return "";
  }

  return cityLabel ? `${neighborhood} - ${cityLabel}` : neighborhood;
}

function summarizeDemographicRows(orders: DemographicOrder[], getLabel: (order: DemographicOrder) => string, limit = 8) {
  const buckets = new Map<string, number>();

  for (const order of orders) {
    const label = getLabel(order);
    if (!label) continue;
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  const locatedTotal = Array.from(buckets.values()).reduce((sum, count) => sum + count, 0);

  return {
    locatedTotal,
    rows: Array.from(buckets.entries())
      .map(([label, count]) => ({
        label,
        count,
        rate: locatedTotal > 0 ? Number(((count / locatedTotal) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
      .slice(0, limit)
  };
}

function summarizeOrderDemographics(orders: DemographicOrder[]) {
  const cities = summarizeDemographicRows(orders, buildCityLabel);
  const neighborhoods = summarizeDemographicRows(orders, buildNeighborhoodLabel);

  return {
    total: orders.length,
    withCity: cities.locatedTotal,
    withNeighborhood: neighborhoods.locatedTotal,
    cities: cities.rows,
    neighborhoods: neighborhoods.rows
  };
}

export async function getEventOrderDemographics(
  eventId: string,
  organizationId: string,
  allowedEventIds?: string[] | null
) {
  const orders = await prisma.order.findMany({
    where: {
      eventId,
      event: {
        organizationId,
        ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
      },
      status: {
        in: [OrderStatus.PAID, OrderStatus.PENDING_PAYMENT]
      }
    },
    select: {
      status: true,
      buyerCity: true,
      buyerState: true,
      buyerNeighborhood: true,
      payment: {
        select: {
          status: true
        }
      }
    }
  });

  const paidOrders = orders.filter(
    (order) => order.status === OrderStatus.PAID && order.payment?.status === PaymentStatus.APPROVED
  );
  const pendingOrders = orders.filter((order) => order.status === OrderStatus.PENDING_PAYMENT);

  return {
    paid: summarizeOrderDemographics(paidOrders),
    pending: summarizeOrderDemographics(pendingOrders)
  };
}

export async function getPublicEventBySlug(slug: string, organizationId: string) {
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true
            }
          },
          typeOptions: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      }
    }
  });
}

export async function getEventSeoBySlug(slug: string, organizationId: string) {
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

  for (const field of ["doorsOpenAt", "startsAt", "endsAt", "salesStartsAt", "salesEndsAt", "createdAt", "updatedAt"]) {
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
  const organizationId = await getDefaultOrganizationId();
  return normalizeCachedEventDates(await getCachedPublicEventBySlugRaw(slug, organizationId));
}

export async function getCachedPublicEventBySlugInOrganization(slug: string, organizationId: string) {
  return normalizeCachedEventDates(await getCachedPublicEventBySlugRaw(slug, organizationId));
}

export async function getCachedEventSeoBySlug(slug: string) {
  const organizationId = await getDefaultOrganizationId();
  return normalizeCachedEventDates(await getCachedEventSeoBySlugRaw(slug, organizationId));
}

export async function getCachedEventSeoBySlugInOrganization(slug: string, organizationId: string) {
  return normalizeCachedEventDates(await getCachedEventSeoBySlugRaw(slug, organizationId));
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
    eventMapLayout: input.eventMapLayout as Prisma.InputJsonValue,
    googleMapsUrl: input.googleMapsUrl || null,
    doorsOpenAt: input.doorsOpenAt || null,
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
    metaConversionsApiToken: input.metaConversionsApiToken || null,
    metaTestEventCode: input.metaTestEventCode || null,
    googleTagManagerId: input.googleTagManagerId || null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    seoKeywords: input.seoKeywords || null,
    seoImageUrl: input.seoImageUrl || null,
    supportWhatsappUrl: input.supportWhatsappUrl || null,
    couponsEnabled: input.couponsEnabled,
    leadCaptureEnabled: input.leadCaptureEnabled,
    leadCaptureHeadline: input.leadCaptureHeadline || null,
    leadCaptureDescription: input.leadCaptureDescription || null,
    leadCaptureOfferText: input.leadCaptureOfferText || null,
    leadCaptureCtaText: input.leadCaptureCtaText || null,
    leadCaptureBadgeText: input.leadCaptureBadgeText || null,
    leadCaptureHeroSupportText: input.leadCaptureHeroSupportText || null,
    leadCaptureBenefitsText: input.leadCaptureBenefitsText || null,
    leadCaptureFormIntroEyebrow: input.leadCaptureFormIntroEyebrow || null,
    leadCaptureFormIntroTitle: input.leadCaptureFormIntroTitle || null,
    leadCaptureFormIntroDescription: input.leadCaptureFormIntroDescription || null,
    leadCaptureFormTimingText: input.leadCaptureFormTimingText || null,
    leadCaptureBonusText: input.leadCaptureBonusText || null,
    leadCaptureProofText: input.leadCaptureProofText || null,
    leadCaptureFooterStatsText: input.leadCaptureFooterStatsText || null,
    leadCaptureHeroImageUrl: input.leadCaptureHeroImageUrl || null,
    leadCaptureHeroCrop: input.leadCaptureHeroCrop || null,
    leadCaptureVenueGallery: input.leadCaptureVenueGallery || null,
    leadCaptureVideoUrl: input.leadCaptureVideoUrl || null,
    leadCaptureWhatsappGroupUrl: input.leadCaptureWhatsappGroupUrl || null,
    leadCaptureThankYouTitle: input.leadCaptureThankYouTitle || null,
    leadCaptureThankYouDescription: input.leadCaptureThankYouDescription || null,
    leadCaptureThankYouButtonText: input.leadCaptureThankYouButtonText || null,
    autoLeadCaptureEmailEnabled: input.autoLeadCaptureEmailEnabled,
    autoPurchaseApprovedEmailEnabled: input.autoPurchaseApprovedEmailEnabled,
    autoPendingPaymentEmailEnabled: input.autoPendingPaymentEmailEnabled,
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          typeOptions: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
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
        eventMapLayout: event.eventMapLayout === null ? Prisma.JsonNull : event.eventMapLayout,
        googleMapsUrl: event.googleMapsUrl,
        doorsOpenAt: event.doorsOpenAt,
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
        metaConversionsApiToken: event.metaConversionsApiToken,
        metaTestEventCode: event.metaTestEventCode,
        googleTagManagerId: event.googleTagManagerId,
        seoTitle: event.seoTitle,
        seoDescription: event.seoDescription,
        seoKeywords: event.seoKeywords,
        seoImageUrl: event.seoImageUrl,
        supportWhatsappUrl: event.supportWhatsappUrl,
        couponsEnabled: event.couponsEnabled,
        leadCaptureEnabled: event.leadCaptureEnabled,
        leadCaptureHeadline: event.leadCaptureHeadline,
        leadCaptureDescription: event.leadCaptureDescription,
        leadCaptureOfferText: event.leadCaptureOfferText,
        leadCaptureCtaText: event.leadCaptureCtaText,
        leadCaptureBadgeText: event.leadCaptureBadgeText,
        leadCaptureHeroSupportText: event.leadCaptureHeroSupportText,
        leadCaptureBenefitsText: event.leadCaptureBenefitsText,
        leadCaptureFormIntroEyebrow: event.leadCaptureFormIntroEyebrow,
        leadCaptureFormIntroTitle: event.leadCaptureFormIntroTitle,
        leadCaptureFormIntroDescription: event.leadCaptureFormIntroDescription,
        leadCaptureFormTimingText: event.leadCaptureFormTimingText,
        leadCaptureBonusText: event.leadCaptureBonusText,
        leadCaptureProofText: event.leadCaptureProofText,
        leadCaptureFooterStatsText: event.leadCaptureFooterStatsText,
        leadCaptureHeroImageUrl: event.leadCaptureHeroImageUrl,
        leadCaptureHeroCrop: event.leadCaptureHeroCrop,
        leadCaptureVenueGallery: event.leadCaptureVenueGallery,
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
          hotelId: lot.hotelId,
          name: lot.name,
          description: lot.description,
          highlightColor: lot.highlightColor,
          saleBadge: lot.saleBadge,
          descriptionAsList: lot.descriptionAsList,
          hasHotel: lot.hasHotel,
          churchQuestionEnabled: lot.churchQuestionEnabled,
          hasTypeOptions: lot.hasTypeOptions,
          admissionsPerUnit: lot.admissionsPerUnit,
          priceInCents: lot.priceInCents,
          serviceFeeBps: lot.serviceFeeBps,
          pixDiscountPercentBps: lot.pixDiscountPercentBps,
          pixDiscountFixedInCents: lot.pixDiscountFixedInCents,
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

      if (lot.hasTypeOptions && lot.typeOptions.length > 0) {
        await tx.ticketLotOption.createMany({
          data: lot.typeOptions.map((option) => ({
            lotId: duplicatedLot.id,
            label: option.label,
            status: option.status,
            reservedQuantity: 0,
            soldQuantity: 0,
            sortOrder: option.sortOrder
          }))
        });
      }
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
