import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import { getOrderReferenceDate, sortOrdersByReferenceDateDesc } from "@/features/orders/order.admin.service";

describe("order reference date ordering", () => {
  it("sorts paid orders by payment time and the others by creation time", () => {
    const orders = [
      { id: "paid-morning", status: OrderStatus.PAID, createdAt: new Date("2026-09-13T09:00:00-03:00"), paidAt: new Date("2026-09-13T10:10:00-03:00") },
      { id: "pending", status: OrderStatus.PENDING_PAYMENT, createdAt: new Date("2026-09-13T10:43:00-03:00"), paidAt: null },
      { id: "paid-afternoon", status: OrderStatus.PAID, createdAt: new Date("2026-09-13T08:00:00-03:00"), paidAt: new Date("2026-09-13T14:45:00-03:00") },
      { id: "paid-eleven", status: OrderStatus.PAID, createdAt: new Date("2026-09-13T07:00:00-03:00"), paidAt: new Date("2026-09-13T11:10:00-03:00") }
    ];

    expect(sortOrdersByReferenceDateDesc(orders).map((order) => order.id)).toEqual([
      "paid-afternoon",
      "paid-eleven",
      "pending",
      "paid-morning"
    ]);
    expect(getOrderReferenceDate(orders[0])).toEqual(orders[0].paidAt);
    expect(getOrderReferenceDate(orders[1])).toEqual(orders[1].createdAt);
  });
});
