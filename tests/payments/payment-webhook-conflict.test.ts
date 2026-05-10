import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
  payment: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn()
  },
  order: {
    updateMany: vi.fn()
  },
  ticket: {
    updateMany: vi.fn(),
    create: vi.fn()
  },
  coupon: {
    update: vi.fn()
  },
  $executeRaw: vi.fn()
};

const sendTicketsEmailMock = vi.fn();
const trackMetaPurchaseMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/features/email/email.service", () => ({
  createPublicTicketUrl: vi.fn(() => "https://tickets.local/teste"),
  sendTicketsEmail: sendTicketsEmailMock
}));

vi.mock("@/features/orders/order.service", () => ({
  expirePendingOrderByCode: vi.fn()
}));

vi.mock("@/features/tracking/meta-conversions.service", () => ({
  trackMetaPurchaseForPaidOrder: trackMetaPurchaseMock
}));

vi.mock("@/features/tickets/ticket-code", () => ({
  createQrCodeToken: vi.fn(() => "qr-token"),
  createTicketCode: vi.fn(() => "ticket-code")
}));

vi.mock("@/features/pricing/pricing", () => ({
  calculateCardInterestInCents: vi.fn(() => 0)
}));

vi.mock("@/features/payments/asaas-split.service", () => ({
  buildAsaasSplitsForOrder: vi.fn(async () => undefined)
}));

vi.mock("@/features/payments/payment-provider", () => ({
  getAsaasProvider: vi.fn(),
  getPaymentProvider: vi.fn()
}));

describe("payment webhook conflict handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not reconfirm stock or recreate tickets when APPROVED arrives for an expired order", async () => {
    const expiredOrderPayment = {
      id: "pay_2",
      orderId: "order_2",
      status: "PENDING",
      amountInCents: 10000,
      externalId: "ext_2",
      order: {
        id: "order_2",
        code: "PED999",
        eventId: "event_1",
        couponId: null,
        status: "EXPIRED",
        ticketsEmailSentAt: null,
        customer: {
          email: "buyer@example.com",
          name: "Buyer"
        },
        items: [
          {
            id: "item_1",
            lotId: "lot_1",
            quantity: 2
          }
        ],
        event: {
          title: "Evento",
          startsAt: new Date("2026-01-01T20:00:00.000Z"),
          venueName: "Local",
          autoPurchaseApprovedEmailEnabled: true,
          organization: {
            name: "A2 Imergidos",
            publicDomain: "a2imergidos.com.br"
          }
        },
        tickets: []
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock as never)
    );
    prismaMock.payment.findFirst.mockResolvedValue(expiredOrderPayment);
    prismaMock.payment.update.mockResolvedValue({
      ...expiredOrderPayment,
      rawPayload: { id: "ext_2" }
    });

    const { handlePaymentWebhook } = await import("@/features/payments/payment.service");

    const result = await handlePaymentWebhook({
      externalId: "ext_2",
      status: "APPROVED",
      rawPayload: { id: "ext_2", value: 100 }
    });

    expect(prismaMock.payment.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_2" },
      data: {
        externalId: "ext_2",
        rawPayload: { id: "ext_2", value: 100 }
      }
    });
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.ticket.create).not.toHaveBeenCalled();
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(sendTicketsEmailMock).not.toHaveBeenCalled();
    expect((result as unknown as typeof expiredOrderPayment).order.status).toBe("EXPIRED");
  });

  it("treats repeated REFUNDED webhook as no-op when payment and order are already refunded", async () => {
    const refundedPayment = {
      id: "pay_3",
      orderId: "order_3",
      status: "REFUNDED",
      amountInCents: 10000,
      externalId: "ext_3",
      order: {
        id: "order_3",
        code: "PED888",
        eventId: "event_1",
        couponId: null,
        status: "REFUNDED",
        ticketsEmailSentAt: new Date(),
        customer: {
          email: "buyer@example.com",
          name: "Buyer"
        },
        items: [
          {
            id: "item_1",
            lotId: "lot_1",
            quantity: 2
          }
        ],
        event: {
          title: "Evento",
          startsAt: new Date("2026-01-01T20:00:00.000Z"),
          venueName: "Local",
          autoPurchaseApprovedEmailEnabled: true,
          organization: {
            name: "A2 Imergidos",
            publicDomain: "a2imergidos.com.br"
          }
        },
        tickets: [
          {
            id: "ticket_1",
            code: "TK1",
            lot: {
              name: "Pista"
            }
          }
        ]
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock as never)
    );
    prismaMock.payment.findFirst.mockResolvedValue(refundedPayment);

    const { handlePaymentWebhook } = await import("@/features/payments/payment.service");

    const result = await handlePaymentWebhook({
      externalId: "ext_3",
      status: "REFUNDED",
      rawPayload: { id: "ext_3", status: "REFUNDED" }
    });

    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    expect(prismaMock.payment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.payment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.ticket.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(sendTicketsEmailMock).not.toHaveBeenCalled();
    expect(result).toBe(refundedPayment);
  });
});
