import type { Prisma } from "@prisma/client";

export function activeOrderEventWhere(now = new Date()): Prisma.EventWhereInput {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { status: "PUBLISHED", OR: [
    { endsAt: { gte: now } },
    { endsAt: null, startsAt: { gte: new Date(`${day}T00:00:00-03:00`) } }
  ] };
}

export function orderEventActivityWhere(activity?: string, now = new Date()): Prisma.EventWhereInput {
  if (activity === "active") return activeOrderEventWhere(now);
  if (activity === "inactive") return { NOT: activeOrderEventWhere(now) };
  return {};
}
