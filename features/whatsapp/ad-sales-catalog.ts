import { prisma } from "@/lib/prisma";

export const PILOT_EVENT_SLUGS = [
  "geriatricus-em-suzano-2026",
  "geriatricus-em-santo-andre-2026"
] as const;

export type SalesLot = {
  id: string;
  name: string;
  priceInCents: number;
  available: number;
  hasNumberedSeats: boolean;
  status: string;
  saleBadge?: string;
  minPerOrder?: number;
  maxPerOrder?: number;
  hasTypeOptions?: boolean;
  salesStartsAt?: Date | null;
  salesEndsAt?: Date | null;
};

export function eligibleSalesLots(lots: SalesLot[], now = new Date()) {
  return lots.filter((lot) =>
    lot.status === "ACTIVE" &&
    lot.saleBadge !== "SOLD_OUT" &&
    !lot.hasTypeOptions &&
    lot.available > 0 &&
    (!lot.salesStartsAt || lot.salesStartsAt <= now) &&
    (!lot.salesEndsAt || lot.salesEndsAt > now) &&
    !lot.hasNumberedSeats &&
    !/\b(camarote|mesa)\b/i.test(lot.name)
  );
}

export async function loadPilotSalesEvents(organizationId: string) {
  const events = await prisma.event.findMany({
    where: {
      organizationId,
      slug: { in: [...PILOT_EVENT_SLUGS] },
      status: "PUBLISHED",
      startsAt: { gt: new Date() }
    },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      salesStartsAt: true,
      salesEndsAt: true,
      seatMaps: {
        where: { isActive: true },
        select: { _count: { select: { seats: true } } }
      },
      lots: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          priceInCents: true,
          saleBadge: true,
          minPerOrder: true,
          maxPerOrder: true,
          hasTypeOptions: true,
          status: true,
          totalQuantity: true,
          reservedQuantity: true,
          soldQuantity: true,
          salesStartsAt: true,
          salesEndsAt: true,
          seats: { select: { id: true }, take: 1 }
        }
      }
    }
  });
  const now = new Date();
  return events.filter((event) =>
    !event.seatMaps.some((map) => map._count.seats > 0) &&
    (!event.salesStartsAt || event.salesStartsAt <= now) &&
    (!event.salesEndsAt || event.salesEndsAt > now)
  )
    .map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    lots: eligibleSalesLots(event.lots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      priceInCents: lot.priceInCents,
      saleBadge: lot.saleBadge,
      minPerOrder: lot.minPerOrder,
      maxPerOrder: lot.maxPerOrder,
      hasTypeOptions: lot.hasTypeOptions,
      status: lot.status,
      salesStartsAt: lot.salesStartsAt,
      salesEndsAt: lot.salesEndsAt,
      available: lot.totalQuantity - lot.reservedQuantity - lot.soldQuantity,
      hasNumberedSeats: lot.seats.length > 0
    })))
  })).filter((event) => event.lots.length > 0)
    .sort((a, b) => PILOT_EVENT_SLUGS.indexOf(a.slug as typeof PILOT_EVENT_SLUGS[number]) - PILOT_EVENT_SLUGS.indexOf(b.slug as typeof PILOT_EVENT_SLUGS[number]));
}

export function isPilotAd(adId: string | null | undefined) {
  const allowed = (process.env.WHATSAPP_SALES_PILOT_AD_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return Boolean(adId && allowed.includes(adId));
}
