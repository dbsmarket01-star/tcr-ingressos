import { afterEach, describe, expect, it, vi } from "vitest";
import { AsaasPaymentProvider, type CreditCardPaymentInput, type PaymentIntentInput } from "@/features/payments/payment-provider";
import type { AsaasOrganizationConfig } from "@/features/payments/payment-organization-config";

const config: AsaasOrganizationConfig = {
  accessToken: "test-token",
  apiKeyEnvName: "ASAAS_API_KEY_A2_IMERGIDOS",
  apiUrl: "https://asaas.test/v3",
  apiUrlEnvName: "ASAAS_API_URL",
  billingType: "CREDIT_CARD",
  billingTypeEnvName: "ASAAS_BILLING_TYPE",
  allowGlobalAsaasSplit: false,
  organizationEnvSuffix: "A2_IMERGIDOS"
};

const basePixInput: PaymentIntentInput = {
  orderId: "order_1",
  orderCode: "ING-123",
  amountInCents: 2500,
  customerName: "Buyer Test",
  customerEmail: "buyer@example.com",
  customerDocument: "123.456.789-09",
  customerPhone: "(11) 99999-9999",
  eventTitle: "A2 Imergidos Gramado",
  eventSlug: "a2-imergidos-gramado"
};

const baseCardInput: CreditCardPaymentInput = {
  ...basePixInput,
  holderName: "Buyer Test",
  number: "4111111111111111",
  expiryMonth: "12",
  expiryYear: "2030",
  ccv: "123",
  holderCpfCnpj: "123.456.789-09",
  holderPostalCode: "01001-000",
  holderAddressNumber: "100",
  installments: 1,
  remoteIp: "127.0.0.1"
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("Asaas payment provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always creates Pix payments with billingType PIX, even if the configured default is credit card", async () => {
    const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
        requests.push({ url, method, body });

        if (url.endsWith("/customers")) {
          return jsonResponse({ id: "cus_123" });
        }

        if (url.endsWith("/payments") && method === "POST") {
          return jsonResponse({ id: "pay_123", status: "PENDING", billingType: body?.billingType, value: body?.value });
        }

        if (url.endsWith("/payments/pay_123/pixQrCode")) {
          return jsonResponse({ encodedImage: "base64-image", payload: "000201", expirationDate: "2026-05-13" });
        }

        return jsonResponse({ errors: [{ description: "not found" }] }, 404);
      })
    );

    const provider = new AsaasPaymentProvider(config);
    const result = await provider.createPaymentIntent(basePixInput);
    const paymentRequest = requests.find((request) => request.url.endsWith("/payments") && request.method === "POST");

    expect(paymentRequest?.body?.billingType).toBe("PIX");
    expect(paymentRequest?.body?.value).toBe(25);
    expect(result.pixQrCodePayload).toBe("000201");
    expect(result.rawPayload).toMatchObject({
      payment: {
        billingType: "PIX"
      }
    });
  });

  it("does not create an Asaas customer when Pix value is zero", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AsaasPaymentProvider(config);

    await expect(provider.createPaymentIntent({ ...basePixInput, amountInCents: 0 })).rejects.toThrow(
      "O valor do Pix precisa ser maior que zero."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not create an Asaas customer when credit card value is zero", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AsaasPaymentProvider(config);

    await expect(provider.createCreditCardPayment({ ...baseCardInput, amountInCents: 0 })).rejects.toThrow(
      "O valor do cartão precisa ser maior que zero."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
