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

describe("payment webhook idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendTicketsEmailMock.mockResolvedValue({
      provider: "resend",
      providerId: "email_123",
      status: "accepted",
      from: "A2 Imergidos <ingressos@a2imergidos.com.br>"
    });
  });

  it("treats repeated APPROVED webhook as no-op when payment is already approved", async () => {
    const approvedPayment = {
      id: "pay_1",
      orderId: "order_1",
      status: "APPROVED",
      amountInCents: 10000,
      externalId: "ext_1",
      order: {
        id: "order_1",
        code: "PED123",
        eventId: "event_1",
        couponId: null,
        status: "PAID",
        ticketsEmailSentAt: new Date(),
        customer: {
          email: "buyer@example.com",
          name: "Buyer"
        },
        items: [],
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
    prismaMock.payment.findFirst.mockResolvedValue(approvedPayment);

    const { handlePaymentWebhook } = await import("@/features/payments/payment.service");

    const result = await handlePaymentWebhook({
      externalId: "ext_1",
      status: "APPROVED"
    });

    expect(prismaMock.payment.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prismaMock.payment.findFirst.mock.calls[0][0];
    expect(findFirstArgs.include.order.select.event).toMatchObject({
      select: {
        title: true,
        startsAt: true,
        venueName: true,
        autoPurchaseApprovedEmailEnabled: true,
        organization: {
          select: {
            name: true,
            publicDomain: true
          }
        }
      }
    });
    expect(findFirstArgs.include.order.select.event.include).toBeUndefined();
    expect(prismaMock.payment.update).not.toHaveBeenCalled();
    expect(prismaMock.payment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(sendTicketsEmailMock).not.toHaveBeenCalled();
    expect(result).toBe(approvedPayment);
  });

  it("records PAYMENT_CREATED/PENDING webhook without issuing tickets", async () => {
    const rawPayload = {
      event: "PAYMENT_CREATED",
      payment: {
        id: "pay_asaas_1",
        externalReference: "PED123",
        status: "PENDING"
      }
    };
    const pendingPayment = {
      id: "pay_4",
      orderId: "order_4",
      status: "PENDING",
      amountInCents: 49700,
      externalId: null,
      order: {
        id: "order_4",
        code: "PED123",
        eventId: "event_1",
        couponId: null,
        status: "PENDING_PAYMENT",
        ticketsEmailSentAt: null,
        customer: {
          email: "buyer@example.com",
          name: "Buyer"
        },
        items: [],
        event: {
          title: "Evento",
          startsAt: new Date("2026-01-01T20:00:00.000Z"),
          venueName: "Local",
          autoPurchaseApprovedEmailEnabled: true,
          organization: {
            name: "TCR Ingressos",
            publicDomain: "tcringressos.app.br"
          }
        },
        tickets: []
      }
    };
    const updatedPayment = {
      ...pendingPayment,
      externalId: "pay_asaas_1",
      rawPayload
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock as never)
    );
    prismaMock.payment.findFirst.mockResolvedValue(pendingPayment);
    prismaMock.payment.update.mockResolvedValue(updatedPayment);

    const { handlePaymentWebhook } = await import("@/features/payments/payment.service");

    const result = await handlePaymentWebhook({
      externalId: "pay_asaas_1",
      orderCode: "PED123",
      status: "PENDING",
      reason: "PAYMENT_CREATED",
      rawPayload
    });

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_4" },
      data: {
        status: "PENDING",
        externalId: "pay_asaas_1",
        rawPayload
      }
    });
    expect(prismaMock.payment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    expect(sendTicketsEmailMock).not.toHaveBeenCalled();
    expect(result).toBe(updatedPayment);
  });

  it("issues tickets and records the Resend id when an APPROVED webhook confirms a pending order", async () => {
    const pendingPayment = {
      id: "pay_5",
      orderId: "order_5",
      status: "PENDING",
      amountInCents: 2500,
      externalId: "pay_asaas_5",
      order: {
        id: "order_5",
        code: "PED555",
        eventId: "event_1",
        couponId: null,
        status: "PENDING_PAYMENT",
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
            quantity: 1
          }
        ],
        event: {
          title: "A2 Imergidos Gramado",
          startsAt: new Date("2026-08-28T18:00:00.000Z"),
          venueName: "Hotel Serra Azul",
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
    prismaMock.payment.findFirst.mockResolvedValue(pendingPayment);
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.ticket.create.mockResolvedValue({
      code: "TICKET-1",
      lot: {
        name: "Ingresso Casal"
      }
    });
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.findUniqueOrThrow.mockResolvedValue({
      ...pendingPayment,
      status: "APPROVED",
      paidAt: new Date("2026-05-12T18:20:00.000Z")
    });
    prismaMock.order.update.mockResolvedValue({
      ...pendingPayment.order,
      ticketsEmailSentAt: new Date("2026-05-12T18:20:01.000Z")
    });

    const { handlePaymentWebhook } = await import("@/features/payments/payment.service");

    await handlePaymentWebhook({
      externalId: "pay_asaas_5",
      orderCode: "PED555",
      status: "APPROVED",
      rawPayload: {
        payment: {
          id: "pay_asaas_5",
          value: 25,
          status: "CONFIRMED",
          billingType: "PIX"
        }
      }
    });

    expect(sendTicketsEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        orderCode: "PED555",
        brandName: "A2 Imergidos",
        tickets: [
          expect.objectContaining({
            code: "TICKET-1",
            lotName: "Ingresso Casal"
          })
        ]
      })
    );
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order_5" },
      data: expect.objectContaining({
        ticketsEmailProviderId: "email_123",
        ticketsEmailStatus: "accepted",
        ticketsEmailLastError: null,
        ticketsEmailAttempts: {
          increment: 1
        }
      })
    });
  });
});
