import { describe, expect, it } from "vitest";
import { getCartAbandonmentEligibilityCutoff } from "@/features/orders/order.service";
import { findAttributableRecovery } from "@/features/reports/cart-recovery-report.service";

describe("cart recovery safety and attribution", () => {
  it("never makes a cart eligible before 15 minutes", () => {
    const createdAt = new Date("2026-10-10T12:00:00.000Z");
    expect(createdAt <= getCartAbandonmentEligibilityCutoff(new Date("2026-10-10T12:14:59.000Z"))).toBe(false);
    expect(createdAt <= getCartAbandonmentEligibilityCutoff(new Date("2026-10-10T12:15:00.000Z"))).toBe(true);
  });

  it("associates only a later paid order in the same event within seven days", () => {
    const send = {
      id: "message-1", eventId: "event-1", orderId: "order-1", recipientPhone: "5511999991234",
      createdAt: new Date("2026-10-10T12:15:00.000Z"), sentAt: null
    };
    expect(findAttributableRecovery({
      id: "order-1", eventId: "event-1", paidAt: new Date("2026-10-10T12:20:00.000Z"), customerPhone: null
    }, [send])?.id).toBe("message-1");
    expect(findAttributableRecovery({
      id: "order-2", eventId: "event-2", paidAt: new Date("2026-10-10T12:20:00.000Z"), customerPhone: "11999991234"
    }, [send])).toBeNull();
    expect(findAttributableRecovery({
      id: "order-2", eventId: "event-1", paidAt: new Date("2026-10-18T12:20:00.000Z"), customerPhone: "11999991234"
    }, [send])).toBeNull();
    expect(findAttributableRecovery({
      id: "order-2", eventId: "event-1", paidAt: new Date("2026-10-10T12:20:00.000Z"), customerPhone: "11999991234"
    }, [send])?.id).toBe("message-1");
  });
});
