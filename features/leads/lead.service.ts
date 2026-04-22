import { ensureDefaultOrganizationBackfill } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";
import type { EventLeadInput } from "./lead.schema";

function sanitizePhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export async function createOrUpdateEventLead(input: EventLeadInput) {
  const organizationId = await ensureDefaultOrganizationBackfill();
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      slug: input.eventSlug,
      organizationId,
      leadCaptureEnabled: true
    },
    select: {
      id: true
    }
  });

  if (!event) {
    throw new Error("Esta página de captação não está disponível no momento.");
  }

  const existingLead = await prisma.eventLead.findUnique({
    where: {
      eventId_email: {
        eventId: event.id,
        email: input.email
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
        email: input.email
      }
    },
    update: {
      name: input.name,
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
      email: input.email,
      phone: sanitizePhone(input.phone),
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmContent: input.utmContent || null,
      utmTerm: input.utmTerm || null,
      referrer: input.referrer || null,
      landingPage: input.landingPage || null
    }
  });

  return {
    lead,
    isExisting: Boolean(existingLead)
  };
}

export async function getLeadCaptureEventBySlug(slug: string) {
  const organizationId = await ensureDefaultOrganizationBackfill();
  return prisma.event.findFirst({
    where: {
      organizationId,
      slug,
      leadCaptureEnabled: true
    },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      bannerUrl: true,
      bannerCrop: true,
      city: true,
      state: true,
      startsAt: true,
      leadCaptureHeadline: true,
      leadCaptureDescription: true,
      leadCaptureOfferText: true,
      leadCaptureCtaText: true,
      leadCaptureHeroImageUrl: true,
      leadCaptureHeroCrop: true,
      leadCaptureVideoUrl: true,
      leadCaptureWhatsappGroupUrl: true,
      leadCaptureThankYouTitle: true,
      leadCaptureThankYouDescription: true,
      leadCaptureThankYouButtonText: true
    }
  });
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
