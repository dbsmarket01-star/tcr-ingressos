import { beforeEach, describe, expect, it, vi } from "vitest";

const findAsaasWebhookOrganizationMock = vi.fn();
const handlePaymentWebhookMock = vi.fn();
const syncAsaasPaymentByExternalIdMock = vi.fn();
const organizationFindManyMock = vi.fn();
const getAsaasWebhookTokenForOrganizationMock = vi.fn();

vi.mock("@/features/payments/payment.service", () => ({
  findAsaasWebhookOrganization: findAsaasWebhookOrganizationMock,
  handlePaymentWebhook: handlePaymentWebhookMock,
  syncAsaasPaymentByExternalId: syncAsaasPaymentByExternalIdMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findMany: organizationFindManyMock
    }
  }
}));

vi.mock("@/features/payments/payment-organization-config", () => ({
  getAsaasWebhookTokenForOrganization: getAsaasWebhookTokenForOrganizationMock
}));

function createAsaasRequest(token: string) {
  return new Request("https://www.a2imergidos.com.br/api/webhooks/payments/asaas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-asaas-token": token
    },
    body: JSON.stringify({
      event: "PAYMENT_CREATED",
      payment: {
        id: "pay_unknown_a2",
        status: "PENDING"
      }
    })
  });
}

describe("Asaas payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    findAsaasWebhookOrganizationMock.mockResolvedValue(null);
    syncAsaasPaymentByExternalIdMock.mockResolvedValue({
      handled: false,
      reason: "not_found"
    });
    organizationFindManyMock.mockResolvedValue([
      {
        id: "org_a2",
        slug: "a2-imergidos",
        name: "A2 Imergidos"
      }
    ]);
    getAsaasWebhookTokenForOrganizationMock.mockImplementation((organization?: { slug?: string }) => ({
      value: organization?.slug === "a2-imergidos" ? "a2-webhook-token" : undefined
    }));
  });

  it("accepts an unknown Asaas payment event when it uses a configured tenant token", async () => {
    const { POST } = await import("@/app/api/webhooks/payments/asaas/route");

    const response = await POST(createAsaasRequest("a2-webhook-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true
    });
    expect(syncAsaasPaymentByExternalIdMock).toHaveBeenCalledWith("pay_unknown_a2");
  });

  it("rejects an unknown Asaas payment event with an invalid tenant token", async () => {
    const { POST } = await import("@/app/api/webhooks/payments/asaas/route");

    const response = await POST(createAsaasRequest("wrong-token"));

    expect(response.status).toBe(401);
    expect(syncAsaasPaymentByExternalIdMock).not.toHaveBeenCalled();
  });

  it("maps Asaas chargeback events as refunded even when the payment still looks confirmed", async () => {
    findAsaasWebhookOrganizationMock.mockResolvedValue({
      id: "org_a2",
      slug: "a2-imergidos",
      name: "A2 Imergidos"
    });
    handlePaymentWebhookMock.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/payments/asaas/route");

    const response = await POST(
      new Request("https://www.a2imergidos.com.br/api/webhooks/payments/asaas", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-asaas-token": "a2-webhook-token"
        },
        body: JSON.stringify({
          event: "PAYMENT_CHARGEBACK_REQUESTED",
          payment: {
            id: "pay_chargeback_a2",
            status: "CONFIRMED",
            externalReference: "ING-CHARGEBACK"
          }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(handlePaymentWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "pay_chargeback_a2",
        orderCode: "ING-CHARGEBACK",
        status: "REFUNDED",
        reason: "PAYMENT_CHARGEBACK_REQUESTED"
      })
    );
  });

  it("maps refused credit card capture events as failed", async () => {
    findAsaasWebhookOrganizationMock.mockResolvedValue({
      id: "org_a2",
      slug: "a2-imergidos",
      name: "A2 Imergidos"
    });
    handlePaymentWebhookMock.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/payments/asaas/route");

    const response = await POST(
      new Request("https://www.a2imergidos.com.br/api/webhooks/payments/asaas", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-asaas-token": "a2-webhook-token"
        },
        body: JSON.stringify({
          event: "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
          payment: {
            id: "pay_refused_a2",
            status: "PENDING",
            externalReference: "ING-REFUSED"
          }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(handlePaymentWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "pay_refused_a2",
        orderCode: "ING-REFUSED",
        status: "FAILED",
        reason: "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
      })
    );
  });

  it("maps deleted Asaas payments as canceled instead of refunded", async () => {
    findAsaasWebhookOrganizationMock.mockResolvedValue({
      id: "org_a2",
      slug: "a2-imergidos",
      name: "A2 Imergidos"
    });
    handlePaymentWebhookMock.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/payments/asaas/route");

    const response = await POST(
      new Request("https://www.a2imergidos.com.br/api/webhooks/payments/asaas", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-asaas-token": "a2-webhook-token"
        },
        body: JSON.stringify({
          event: "PAYMENT_DELETED",
          payment: {
            id: "pay_deleted_a2",
            status: "DELETED",
            externalReference: "ING-DELETED"
          }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(handlePaymentWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "pay_deleted_a2",
        orderCode: "ING-DELETED",
        status: "CANCELED",
        reason: "PAYMENT_DELETED"
      })
    );
  });
});
