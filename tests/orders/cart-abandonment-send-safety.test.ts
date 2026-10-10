import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  order: { findMany: vi.fn(), updateMany: vi.fn() },
  payment: { findUnique: vi.fn() }
}));
const sendCartAbandonmentWhatsApp = vi.hoisted(() => vi.fn());
const syncAsaasPaymentByOrderCode = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/features/whatsapp/whatsapp.service", () => ({ sendCartAbandonmentWhatsApp }));
vi.mock("@/features/payments/payment.service", () => ({ syncAsaasPaymentByOrderCode }));

import { sendCartAbandonmentReminders } from "@/features/orders/order.service";

const candidate = {
  id: "order-1", code: "ING-TEST", eventId: "event-1", createdAt: new Date("2026-10-10T12:00:00Z"),
  expiresAt: new Date("2026-10-10T14:00:00Z"),
  customer: { name: "Cliente", phone: "5511999991234" },
  event: { title: "Evento", organization: { id: "org-1", name: "TCR", publicDomain: "tcringressos.app.br", adminDomain: null } },
  items: []
};

describe("cart abandonment send safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.order.findMany.mockResolvedValue([candidate]);
    db.payment.findUnique.mockResolvedValue(null);
    db.order.updateMany.mockResolvedValue({ count: 0 });
  });

  it("claims only unpaid orders and never sends if payment completed meanwhile", async () => {
    const result = await sendCartAbandonmentReminders({ now: new Date("2026-10-10T12:15:00Z") });
    expect(db.order.findMany.mock.calls[0][0].where.createdAt.lte).toEqual(new Date("2026-10-10T12:00:00Z"));
    expect(db.order.updateMany.mock.calls[0][0].where).toMatchObject({
      id: "order-1", status: "PENDING_PAYMENT", paidAt: null,
      NOT: { payment: { is: { status: "APPROVED" } } }
    });
    expect(sendCartAbandonmentWhatsApp).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("does not send when Asaas verification fails", async () => {
    db.payment.findUnique.mockResolvedValue({ provider: "ASAAS", externalId: "pay-1" });
    syncAsaasPaymentByOrderCode.mockRejectedValue(new Error("Asaas temporarily unavailable"));
    const result = await sendCartAbandonmentReminders({ now: new Date("2026-10-10T12:15:00Z") });
    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(sendCartAbandonmentWhatsApp).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});
