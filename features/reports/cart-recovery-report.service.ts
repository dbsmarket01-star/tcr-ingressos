import { prisma } from "@/lib/prisma";

const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function phoneKey(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

export type RecoverySend = {
  id: string;
  eventId: string | null;
  orderId: string | null;
  recipientPhone: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

export function findAttributableRecovery<T extends RecoverySend>(
  order: { id: string; eventId: string; paidAt: Date | null; customerPhone: string | null },
  sends: T[]
) {
  if (!order.paidAt) return null;
  const customerPhone = phoneKey(order.customerPhone);
  return sends
    .filter((send) => {
      const sentAt = send.sentAt ?? send.createdAt;
      const elapsed = order.paidAt!.getTime() - sentAt.getTime();
      return send.eventId === order.eventId &&
        elapsed >= 0 && elapsed <= ATTRIBUTION_WINDOW_MS &&
        (send.orderId === order.id || (customerPhone && phoneKey(send.recipientPhone) === customerPhone));
    })
    .sort((a, b) =>
      Number(b.orderId === order.id) - Number(a.orderId === order.id) ||
      (b.sentAt ?? b.createdAt).getTime() - (a.sentAt ?? a.createdAt).getTime()
    )[0] ?? null;
}

type EventRow = {
  eventId: string;
  eventTitle: string;
  attempts: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  replies: number;
  paidOrders: number;
  originalOrdersPaid: number;
  tickets: number;
  grossInCents: number;
};

function emptyRow(eventId: string, eventTitle: string): EventRow {
  return {
    eventId, eventTitle, attempts: 0, accepted: 0, delivered: 0, read: 0,
    failed: 0, replies: 0, paidOrders: 0, originalOrdersPaid: 0,
    tickets: 0, grossInCents: 0
  };
}

export async function getCartRecoveryReport(
  organizationId: string,
  days: 7 | 30 = 7,
  allowedEventIds?: string[] | null
) {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const [messages, paidOrders, inbound] = await Promise.all([
    prisma.whatsAppMessageLog.findMany({
      where: {
        organizationId, type: "CART_ABANDONMENT", createdAt: { gte: since, lte: until },
        ...(allowedEventIds ? { eventId: { in: allowedEventIds } } : {})
      },
      select: {
        id: true, eventId: true, orderId: true, recipientPhone: true, status: true,
        createdAt: true, sentAt: true, deliveredAt: true, readAt: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
        event: { organizationId, ...(allowedEventIds ? { id: { in: allowedEventIds } } : {}) },
        status: "PAID", paidAt: { gte: since, lte: until },
        payment: { is: { status: "APPROVED" } }
      },
      select: {
        id: true, eventId: true, paidAt: true, totalInCents: true, refundedInCents: true,
        customer: { select: { phone: true } },
        tickets: { where: { status: { in: ["ACTIVE", "USED"] } }, select: { id: true } }
      }
    }),
    prisma.whatsAppMessageLog.findMany({
      where: { organizationId, type: "WEBHOOK", status: "RECEIVED", createdAt: { gte: since, lte: until } },
      select: { recipientPhone: true, createdAt: true }
    })
  ]);

  const eventIds = [...new Set(messages.map((message) => message.eventId).filter((id): id is string => !!id))];
  const events = await prisma.event.findMany({
    where: { organizationId, id: { in: eventIds } },
    select: { id: true, title: true }
  });
  const rows = new Map(events.map((event) => [event.id, emptyRow(event.id, event.title)]));
  const accepted = messages.filter((message) => message.status !== "FAILED");

  for (const message of messages) {
    const row = message.eventId ? rows.get(message.eventId) : null;
    if (!row) continue;
    row.attempts++;
    if (message.status === "FAILED") { row.failed++; continue; }
    row.accepted++;
    if (message.deliveredAt || message.readAt || ["DELIVERED", "READ"].includes(message.status)) row.delivered++;
    if (message.readAt || message.status === "READ") row.read++;
    const sentAt = message.sentAt ?? message.createdAt;
    const phone = phoneKey(message.recipientPhone);
    if (phone && inbound.some((reply) =>
      phoneKey(reply.recipientPhone) === phone &&
      reply.createdAt > sentAt &&
      reply.createdAt.getTime() - sentAt.getTime() <= ATTRIBUTION_WINDOW_MS
    )) row.replies++;
  }

  for (const order of paidOrders) {
    const source = findAttributableRecovery({
      id: order.id, eventId: order.eventId, paidAt: order.paidAt, customerPhone: order.customer.phone
    }, accepted);
    const row = source ? rows.get(order.eventId) : null;
    if (!row) continue;
    row.paidOrders++;
    if (source?.orderId === order.id) row.originalOrdersPaid++;
    row.tickets += order.tickets.length;
    row.grossInCents += Math.max(0, order.totalInCents - order.refundedInCents);
  }

  const byEvent = [...rows.values()].sort((a, b) => b.accepted - a.accepted || a.eventTitle.localeCompare(b.eventTitle));
  const totals = byEvent.reduce((total, row) => {
    for (const key of ["attempts", "accepted", "delivered", "read", "failed", "replies", "paidOrders", "originalOrdersPaid", "tickets", "grossInCents"] as const) {
      total[key] += row[key];
    }
    return total;
  }, emptyRow("all", "Total"));

  return { since, until, days, byEvent, totals };
}
