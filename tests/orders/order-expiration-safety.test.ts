import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), transaction: vi.fn(), sql: vi.fn(), paymentUpdate: vi.fn(), seats: vi.fn(), home: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany: m.findMany, findFirst: m.findFirst }, $transaction: m.transaction } }));
vi.mock("@/features/seat-maps/seat-map.service", () => ({ releaseSeatReservationsForOrder: m.seats }));
vi.mock("@/features/hospitality/home-list.service", () => ({ updateHomeListStatusForOrder: m.home }));
import { expirePendingOrders, expirePendingOrderByCode } from "@/features/orders/order.service";
const now = new Date("2026-11-23T15:30:00Z");
const order = { id: "synthetic", code: "TEST", status: "PENDING_PAYMENT", expiresAt: new Date(now.getTime() - 1), expiredEmailSentAt: now, items: [{ lotId: "lot", lotOptionId: "box-23", quantity: 1 }], payment: { id: "payment", status: "PENDING" } };
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  m.findMany.mockResolvedValue([order]); m.findFirst.mockResolvedValue(order);
  m.updateMany.mockResolvedValue({ count: 1 });
  m.transaction.mockImplementation(callback => callback({ order: { updateMany: m.updateMany }, $executeRaw: m.sql, payment: { update: m.paymentUpdate } }));
});
afterEach(() => vi.useRealTimers());
it("scopes expiration to the organization and releases lot, numbered option and seats", async () => {
  expect(await expirePendingOrders({ organizationId: "tcr", now })).toEqual({ expiredCount: 1, releasedQuantity: 1 });
  const where = m.findMany.mock.calls[0][0].where;
  expect(where.event.organizationId).toBe("tcr"); expect(where.status).toBe("PENDING_PAYMENT"); expect(where.expiresAt.lt).toEqual(now);
  expect(m.sql).toHaveBeenCalledTimes(2);
  expect(m.sql.mock.calls[0][0].join("")).toContain('UPDATE "TicketLot"');
  expect(m.sql.mock.calls[1][0].join("")).toContain('UPDATE "TicketLotOption"');
  expect(m.sql.mock.calls[1].slice(1)).toEqual([1, "box-23"]);
  expect(m.seats).toHaveBeenCalledWith(expect.anything(), "synthetic", now);
});
it("does not release stock when a payment or another expiration wins the order transition", async () => {
  m.updateMany.mockResolvedValue({ count: 0 });
  expect(await expirePendingOrders({ organizationId: "tcr", now })).toEqual({ expiredCount: 0, releasedQuantity: 0 });
  expect(m.updateMany.mock.calls[0][0].where.status).toBe("PENDING_PAYMENT");
  expect(m.sql).not.toHaveBeenCalled(); expect(m.paymentUpdate).not.toHaveBeenCalled(); expect(m.seats).not.toHaveBeenCalled();
});
it.each(["PAID", "EXPIRED", "CANCELED"])("never expires a %s order from its public page", async status => {
  m.findFirst.mockResolvedValue({ ...order, status });
  expect(await expirePendingOrderByCode("TEST", "tcr")).toEqual({ expiredCount: 0, releasedQuantity: 0 });
  expect(m.transaction).not.toHaveBeenCalled();
});
it("keeps a reservation until its deadline, then releases it once", async () => {
  m.findFirst.mockResolvedValue({ ...order, expiresAt: now });
  expect((await expirePendingOrderByCode("TEST", "tcr")).expiredCount).toBe(0);
  vi.setSystemTime(new Date(now.getTime() + 1));
  expect((await expirePendingOrderByCode("TEST", "tcr")).expiredCount).toBe(1);
  m.updateMany.mockResolvedValue({ count: 0 });
  expect((await expirePendingOrderByCode("TEST", "tcr")).expiredCount).toBe(0);
  expect(m.sql).toHaveBeenCalledTimes(2);
});

vi.mock("@/features/settings/company-settings.service", () => ({ getOrderReservationMinutes: vi.fn(async (org: string) => org === "tcr" ? 15 : 1440) }));
it.each([ ["tcr", 15], ["other", 1440] ])("creates an isolated numbered reservation using %s tenant's configured deadline", async (org, minutes) => {
  const create = vi.fn(async ({ data }) => ({ ...data, id: "synthetic-order", items: [{ id: "item", lotId: "lot" }] }));
  m.sql.mockResolvedValue(1);
  m.transaction.mockImplementation(callback => callback({
    event: { findFirst: vi.fn(async () => ({ id: "event", slug: "test", organizationId: org, organization: { slug: "test" }, couponsEnabled: false })) },
    customer: { findFirst: vi.fn(async () => ({ id: "buyer" })), update: vi.fn(async () => ({ id: "buyer" })) },
    ticketLot: { findFirst: vi.fn(async () => ({ id: "lot", name: "Camarote teste", minPerOrder: 1, maxPerOrder: 1, hasTypeOptions: true, priceInCents: 10000, serviceFeeBps: 0, pixDiscountPercentBps: 0, pixDiscountFixedInCents: 0, admissionsPerUnit: 6 })) },
    ticketLotOption: { findFirst: vi.fn(async () => ({ id: "box-23", label: "23" })) },
    paymentSplitRule: { findMany: vi.fn(async () => []) },
    companySettings: { findUnique: vi.fn(async () => ({ pixTransactionFeeInCents: 0 })) },
    $executeRaw: m.sql, order: { create }
  }));
  const { createCheckoutOrder } = await import("@/features/orders/order.service");
  const result = await createCheckoutOrder({ eventId: "event", eventSlug: "test", buyerName: "Synthetic", buyerEmail: "test@example.test", buyerDocument: "52998224725", items: [{ lotId: "lot", lotOptionId: "box-23", quantity: 1 }] } as Parameters<typeof createCheckoutOrder>[0], String(org));
  expect(result.expiresAt).toEqual(new Date(now.getTime() + Number(minutes) * 60000));
  expect(create.mock.calls[0][0].data.items.create[0].lotOptionId).toBe("box-23");
  expect(m.sql).toHaveBeenCalledTimes(2);
  expect(result.status).toBe("PENDING_PAYMENT");
});
