import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import type { EventLeadInput } from "./lead.schema";
import { unstable_cache } from "next/cache";

const LEAD_CAPTURE_LIMIT_WINDOW_MINUTES = 10;
const LEAD_CAPTURE_MAX_ATTEMPTS_PER_IP = 18;

function sanitizePhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashIp(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function enforceLeadCaptureRateLimit(eventId: string, clientIp?: string | null) {
  if (!clientIp) {
    return;
  }

  const ipHash = hashIp(clientIp);
  const windowStart = new Date(Date.now() - LEAD_CAPTURE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  const attemptsInWindow = await prisma.leadCaptureAttempt.count({
    where: {
      eventId,
      ipHash,
      createdAt: {
        gte: windowStart
      }
    }
  });

  if (attemptsInWindow >= LEAD_CAPTURE_MAX_ATTEMPTS_PER_IP) {
    throw new Error("Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.");
  }

  await prisma.leadCaptureAttempt.create({
    data: {
      eventId,
      ipHash
    }
  });
}

export async function createOrUpdateEventLead(
  input: EventLeadInput,
  organizationId?: string | null,
  clientIp?: string | null
) {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      slug: input.eventSlug,
      ...(organizationId ? { organizationId } : {}),
      leadCaptureEnabled: true
    },
    select: {
      id: true,
      title: true
    }
  });

  if (!event) {
    throw new Error("Esta página de captação não está disponível no momento.");
  }

  const normalizedEmail = normalizeEmail(input.email);

  await enforceLeadCaptureRateLimit(event.id, clientIp);

  const existingLead = await prisma.eventLead.findUnique({
    where: {
      eventId_email: {
        eventId: event.id,
        email: normalizedEmail
      }
    },
    select: {
      id: true
    }
  });

  const lead = await prisma.eventLead.upsert({
    where: {
      eventId_email: {
        eventId: event.id,
        email: normalizedEmail
      }
    },
    update: {
      name: input.name,
      email: normalizedEmail,
      phone: sanitizePhone(input.phone),
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmContent: input.utmContent || null,
      utmTerm: input.utmTerm || null,
      referrer: input.referrer || null,
      landingPage: input.landingPage || null
    },
    create: {
      eventId: event.id,
      name: input.name,
      email: normalizedEmail,
      phone: sanitizePhone(input.phone),
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmContent: input.utmContent || null,
      utmTerm: input.utmTerm || null,
      referrer: input.referrer || null,
      landingPage: input.landingPage || null
    },
    include: {
      event: {
        select: {
          title: true
        }
      }
    }
  });

  return {
    lead,
    isExisting: Boolean(existingLead)
  };
}

export async function getLeadCaptureEventBySlug(slug: string, organizationId?: string | null) {
  return unstable_cache(
    async (eventSlug: string, eventOrganizationId?: string | null) =>
      prisma.event.findFirst({
        where: {
          ...(eventOrganizationId ? { organizationId: eventOrganizationId } : {}),
          slug: eventSlug,
          leadCaptureEnabled: true
        },
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          metaPixelId: true,
          metaConversionsApiToken: true,
          metaTestEventCode: true,
          googleTagManagerId: true,
          bannerUrl: true,
          bannerCrop: true,
          venueName: true,
          venueAddress: true,
          city: true,
          state: true,
          startsAt: true,
          leadCaptureHeadline: true,
          leadCaptureDescription: true,
          leadCaptureOfferText: true,
          leadCaptureCtaText: true,
          leadCaptureHeroImageUrl: true,
          leadCaptureHeroCrop: true,
          leadCaptureVenueGallery: true,
          leadCaptureVideoUrl: true,
          leadCaptureWhatsappGroupUrl: true,
          leadCaptureThankYouTitle: true,
          leadCaptureThankYouDescription: true,
          leadCaptureThankYouButtonText: true
        }
      }),
    ["lead-capture-event-by-slug"],
    { revalidate: 60 }
  )(slug, organizationId ?? null);
}

export async function listEventLeads(eventId: string) {
  return prisma.eventLead.findMany({
    where: {
      eventId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}
