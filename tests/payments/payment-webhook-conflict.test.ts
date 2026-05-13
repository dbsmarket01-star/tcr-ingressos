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
    update: vi.fn(),
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

vi.mock("@/features/hospitality/home-list.service", () => ({
  createHomeListEntriesForApprovedOrder: vi.fn(),
  updateHomeListStatusForOrder: vi.fn()
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
    sendTicketsEmailMock.mockResolvedValue({
      provider: "resend",
      providerId: "email_expired",
      status: "accepted",
      from: "A2 Imergidos <ingressos@a2imergidos.com.br>"
    });
  });

  it("confirms an expired order when Asaas later reports a received Pix", async () => {
    const expiredOrderPayment = {
      id: "pay_2",
      orderId: "order_2",
      status: "CANCELED",
      amountInCents: 10000,
      externalId: "ext_2",
      order: {
        id: "order_2",
        code: "PED999",
        eventId: "event_1",
        couponId: null,
        status: "EXPIRED",
        ticketsEmailSentAt: null,
        ticketsEmailStatus: null,
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
            publicDomain: "a2imergidos.com.br",
            adminDomain: "produtor.a2imergidos.com.br",
            primaryColor: "#0f5f8c"
          }
        },
        tickets: []
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock as never)
    );
    prismaMock.payment.findFirst.mockResolvedValue(expiredOrderPayment);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.ticket.create
      .mockResolvedValueOnce({
        code: "TICKET-1",
        lot: {
          name: "Pista"
        }
      })
      .mockResolvedValueOnce({
        code: "TICKET-2",
        lot: {
          name: "Pista"
        }
      });
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.findUniqueOrThrow.mockResolvedValue({
      ...expiredOrderPayment,
      status: "APPROVED",
      rawPayload: { id: "ext_2" }
    });

    const { handlePaymentWebhook } = await import("@/features/payments/payment.service");

    const result = await handlePaymentWebhook({
      externalId: "ext_2",
      status: "APPROVED",
      rawPayload: { id: "ext_2", value: 100 }
    });

    expect(prismaMock.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "pay_2",
        status: {
          in: ["CREATED", "PENDING", "CANCELED", "FAILED"]
        }
      },
      data: expect.objectContaining({
        status: "APPROVED",
        externalId: "ext_2",
        amountInCents: 10000
      })
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order_2",
        status: {
          in: ["PENDING_PAYMENT", "EXPIRED", "CANCELED"]
        }
      },
      data: expect.objectContaining({
        status: "PAID",
        totalInCents: 10000,
        canceledAt: null
      })
    });
    expect(prismaMock.ticket.create).toHaveBeenCalledTimes(2);
    expect(sendTicketsEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        orderCode: "PED999",
        tickets: [
          expect.objectContaining({ code: "TICKET-1" }),
          expect.objectContaining({ code: "TICKET-2" })
        ]
      })
    );
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order_2" },
      data: {
        ticketsEmailSentAt: expect.any(Date),
        ticketsEmailProviderId: "email_expired",
        ticketsEmailStatus: "accepted",
        ticketsEmailLastCheckedAt: expect.any(Date),
        ticketsEmailLastError: null,
        ticketsEmailAttempts: {
          increment: 1
        }
      }
    });
    expect(result).toEqual(expect.objectContaining({ status: "APPROVED" }));
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
