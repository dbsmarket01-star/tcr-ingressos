import { prisma } from "@/lib/prisma";
import type { EventLeadInput } from "./lead.schema";

function sanitizePhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

export async function createOrUpdateEventLead(input: EventLeadInput) {
  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      slug: input.eventSlug,
      leadCaptureEnabled: true
    },
    select: {
      id: true
    }
  });

  if (!event) {
    throw new Error("Esta página de captação não está disponível no momento.");
  }

  return prisma.eventLead.upsert({
    where: {
      eventId_email: {
        eventId: event.id,
        email: input.email
      }
    },
    update: {
      name: input.name,
      phone: sanitizePhone(input.phone)
    },
    create: {
      eventId: event.id,
      name: input.name,
      email: input.email,
      phone: sanitizePhone(input.phone)
    }
  });
}

export async function getLeadCaptureEventBySlug(slug: string) {
  return prisma.event.findFirst({
    where: {
      slug,
      leadCaptureEnabled: true
    },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      bannerUrl: true,
      city: true,
      state: true,
      startsAt: true,
      leadCaptureHeadline: true,
      leadCaptureDescription: true,
      leadCaptureOfferText: true,
      leadCaptureCtaText: true,
      leadCaptureHeroImageUrl: true,
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
