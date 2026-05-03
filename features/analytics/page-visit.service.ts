import { EventPageVisitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function formatBrazilDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function recordEventPageVisit(input: {
  eventId: string;
  pageType: EventPageVisitType;
  sessionKey: string;
}) {
  const eventId = input.eventId.trim();
  const sessionKey = input.sessionKey.trim();

  if (!eventId || !sessionKey) {
    return;
  }

  const now = new Date();
  const visitedOn = formatBrazilDateKey(now);

  await prisma.eventPageVisit.upsert({
    where: {
      eventId_pageType_sessionKey_visitedOn: {
        eventId,
        pageType: input.pageType,
        sessionKey,
        visitedOn
      }
    },
    update: {
      lastVisitedAt: now
    },
    create: {
      eventId,
      pageType: input.pageType,
      sessionKey,
      visitedOn,
      firstVisitedAt: now
    }
  });
}

export async function countEventPageVisits(eventId: string, pageType: EventPageVisitType) {
  return prisma.eventPageVisit.count({
    where: {
      eventId,
      pageType
    }
  });
}

export async function countEventPageVisitsInRange(input: {
  pageType: EventPageVisitType;
  dateFrom: string;
  dateTo: string;
  eventIds?: string[] | null;
}) {
  return prisma.eventPageVisit.count({
    where: {
      pageType: input.pageType,
      visitedOn: {
        gte: input.dateFrom,
        lte: input.dateTo
      },
      ...(input.eventIds ? { eventId: { in: input.eventIds } } : {})
    }
  });
}
