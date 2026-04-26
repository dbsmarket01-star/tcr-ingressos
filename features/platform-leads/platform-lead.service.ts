import { prisma } from "@/lib/prisma";
import type { PlatformLeadInput } from "./platform-lead.schema";

export async function createOrUpdatePlatformLead(input: PlatformLeadInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim();
  const normalizedInstagram = input.instagramHandle?.trim().replace(/^@+/, "") || null;
  const normalizedNiche = input.eventNiche.trim();

  const existingLead = await prisma.platformLead.findUnique({
    where: {
      email: normalizedEmail
    }
  });

  const lead = await prisma.platformLead.upsert({
    where: {
      email: normalizedEmail
    },
    update: {
      name: input.name.trim(),
      phone: normalizedPhone,
      annualRevenueBand: input.annualRevenueBand.trim(),
      instagramHandle: normalizedInstagram,
      eventNiche: normalizedNiche
    },
    create: {
      name: input.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      annualRevenueBand: input.annualRevenueBand.trim(),
      instagramHandle: normalizedInstagram,
      eventNiche: normalizedNiche
    }
  });

  return {
    lead,
    isExisting: Boolean(existingLead)
  };
}

export async function listRecentPlatformLeads(limit = 6) {
  return prisma.platformLead.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}

export async function listPlatformLeads(query?: string) {
  const normalizedQuery = query?.trim();

  return prisma.platformLead.findMany({
    where: normalizedQuery
      ? {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" } },
            { email: { contains: normalizedQuery, mode: "insensitive" } },
            { phone: { contains: normalizedQuery, mode: "insensitive" } },
            { eventNiche: { contains: normalizedQuery, mode: "insensitive" } },
            { instagramHandle: { contains: normalizedQuery.replace(/^@+/, ""), mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: {
      createdAt: "desc"
    }
  });
}
