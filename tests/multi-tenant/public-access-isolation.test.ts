import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  order: {
    findFirst: vi.fn()
  },
  ticket: {
    findFirst: vi.fn()
  }
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/features/coupons/coupon.service", () => ({
  calculateCouponDiscountInCents: vi.fn(() => 0),
  getValidCouponForEvent: vi.fn(async () => null)
}));

vi.mock("@/features/email/email.service", () => ({
  createPublicOrderUrl: vi.fn(() => "https://pedidos.local/teste"),
  sendOrderExpiredEmail: vi.fn()
}));

vi.mock("@/features/pricing/pricing", () => ({
  calculatePixDiscountInCents: vi.fn(() => 0),
  calculateServiceFeeInCents: vi.fn(() => 0)
}));

vi.mock("@/features/settings/company-settings.service", () => ({
  getOrderReservationMinutes: vi.fn(async () => 30)
}));

describe("public order and ticket tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes public order lookup by the current organization", async () => {
    const order = { id: "order_a2", code: "ING-123" };

    prismaMock.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(order);

    const { getOrderByCode } = await import("@/features/orders/order.service");

    await expect(getOrderByCode("ING-123", "org_a2")).resolves.toBe(order);

    expect(prismaMock.order.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          code: "ING-123",
          event: {
            organizationId: "org_a2"
          }
        }
      })
    );
    expect(prismaMock.order.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          code: "ING-123",
          event: {
            organizationId: "org_a2"
          }
        }
      })
    );
  });

  it("scopes public ticket lookup by the current organization", async () => {
    const ticket = { id: "ticket_a2", code: "TK-123" };

    prismaMock.ticket.findFirst.mockResolvedValue(ticket);

    const { getTicketByCode } = await import("@/features/tickets/ticket.service");

    await expect(getTicketByCode("TK-123", "org_a2")).resolves.toBe(ticket);

    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          code: "TK-123",
          event: {
            organizationId: "org_a2"
          }
        }
      })
    );
  });
});
