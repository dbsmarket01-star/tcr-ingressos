import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn()
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/features/coupons/coupon.service", () => ({
  calculateCouponDiscountInCents: vi.fn(() => 0),
  calculateCouponEligibleAmountInCents: vi.fn((subtotalInCents: number, serviceFeeInCents: number) => subtotalInCents + serviceFeeInCents),
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

describe("order reservation concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not create an order when the atomic lot reservation fails", async () => {
    const txMock = {
      event: {
        findFirst: vi.fn(async () => ({ id: "event_1" }))
      },
      customer: {
        findFirst: vi.fn(async () => ({
          id: "customer_1",
          name: "Buyer",
          email: "buyer@example.com",
          document: "123"
        })),
        update: vi.fn(async (input) => ({ id: "customer_1", ...input.data })),
        create: vi.fn()
      },
      ticketLot: {
        findFirst: vi.fn(async () => ({
          id: "lot_1",
          eventId: "event_1",
          status: "ACTIVE",
          name: "Pista",
          minPerOrder: 1,
          maxPerOrder: 4,
          salesStartsAt: null,
          salesEndsAt: null,
          priceInCents: 10000,
          serviceFeeBps: 0,
          pixDiscountPercentBps: 0,
          pixDiscountFixedInCents: 0,
          cardInterestBpsPerInstallment: 0,
          cardInterestStartsAtInstallment: 99
        }))
      },
      $executeRaw: vi.fn(async () => 0),
      order: {
        create: vi.fn()
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock as never)
    );

    const { createCheckoutOrder } = await import("@/features/orders/order.service");

    await expect(
      createCheckoutOrder({
        eventId: "event_1",
        eventSlug: "evento-teste",
        buyerName: "Buyer",
        buyerEmail: "buyer@example.com",
        buyerDocument: "123",
        buyerPostalCode: "25250-000",
        buyerCity: "Duque de Caxias",
        buyerPhone: undefined,
        couponCode: undefined,
        items: [
          {
            lotId: "lot_1",
            quantity: 2
          }
        ],
        utmSource: undefined,
        utmMedium: undefined,
        utmCampaign: undefined,
        utmContent: undefined,
        utmTerm: undefined,
        referrer: undefined,
        landingPage: undefined,
        metaFbp: undefined,
        metaFbc: undefined,
        clientIpAddress: undefined,
        clientUserAgent: undefined
      })
    ).rejects.toThrow("Ingressos insuficientes para Pista.");

    expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(txMock.order.create).not.toHaveBeenCalled();
  });

  it("blocks hotel checkout when the companion CPF is invalid", async () => {
    const txMock = {
      event: {
        findFirst: vi.fn(async () => ({ id: "event_1", couponsEnabled: false }))
      },
      customer: {
        findFirst: vi.fn(async () => ({
          id: "customer_1",
          name: "Buyer",
          email: "buyer@example.com",
          document: "52998224725"
        })),
        update: vi.fn(async (input) => ({ id: "customer_1", ...input.data })),
        create: vi.fn()
      },
      ticketLot: {
        findFirst: vi.fn(async () => ({
          id: "lot_1",
          eventId: "event_1",
          status: "ACTIVE",
          name: "Ingresso com hotel",
          minPerOrder: 1,
          maxPerOrder: 4,
          salesStartsAt: null,
          salesEndsAt: null,
          priceInCents: 10000,
          serviceFeeBps: 0,
          pixDiscountPercentBps: 0,
          pixDiscountFixedInCents: 0,
          cardInterestBpsPerInstallment: 0,
          cardInterestStartsAtInstallment: 99,
          churchQuestionEnabled: false,
          hasHotel: true,
          hotelId: "hotel_1",
          hotel: {
            id: "hotel_1",
            name: "Hotel Teste"
          }
        }))
      },
      $executeRaw: vi.fn(async () => 1),
      order: {
        create: vi.fn()
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock as never)
    );

    const { createCheckoutOrder } = await import("@/features/orders/order.service");

    await expect(
      createCheckoutOrder({
        eventId: "event_1",
        eventSlug: "evento-teste",
        buyerName: "Buyer",
        buyerEmail: "buyer@example.com",
        buyerDocument: "52998224725",
        buyerPostalCode: "25250-000",
        buyerCity: "Duque de Caxias",
        buyerPhone: "11999999999",
        couponCode: undefined,
        items: [
          {
            lotId: "lot_1",
            quantity: 1
          }
        ],
        hotelGuests: [
          {
            lotId: "lot_1",
            guestIndex: 1,
            guest1Name: "Buyer",
            guest1Document: "529.982.247-25",
            guest1BirthDate: "1990-01-01",
            guest1Email: "buyer@example.com",
            guest1Phone: "11999999999",
            guest2Name: "Acompanhante",
            guest2Document: "111.111.111-11",
            guest2BirthDate: "1991-01-01"
          }
        ],
        utmSource: undefined,
        utmMedium: undefined,
        utmCampaign: undefined,
        utmContent: undefined,
        utmTerm: undefined,
        referrer: undefined,
        landingPage: undefined,
        metaFbp: undefined,
        metaFbc: undefined,
        clientIpAddress: undefined,
        clientUserAgent: undefined
      })
    ).rejects.toThrow("Informe um CPF válido para o acompanhante em Ingresso com hotel - hospedagem 1.");

    expect(txMock.order.create).not.toHaveBeenCalled();
  });
});
