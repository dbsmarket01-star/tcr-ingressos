import { PaymentProvider as PrismaPaymentProvider } from "@prisma/client";

export type PaymentIntentInput = {
  orderId: string;
  orderCode: string;
  amountInCents: number;
  customerName: string;
  customerEmail: string;
  customerDocument: string | null;
  customerPhone: string | null;
  eventTitle: string;
  eventSlug: string;
  split?: AsaasSplit[];
};

export type CreditCardPaymentInput = PaymentIntentInput & {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderCpfCnpj: string;
  holderPostalCode: string;
  holderAddressNumber: string;
  holderAddressComplement?: string;
  installments: number;
  remoteIp: string;
};

export type PaymentIntentResult = {
  provider: PrismaPaymentProvider;
  externalId: string;
  checkoutUrl?: string;
  pixQrCodeImage?: string;
  pixQrCodePayload?: string;
  pixExpiresAt?: Date;
  status: "CREATED" | "PENDING" | "APPROVED" | "FAILED";
  rawPayload?: unknown;
};

export interface PaymentProvider {
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
}

export class SimulatedPaymentProvider implements PaymentProvider {
  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      provider: PrismaPaymentProvider.SIMULATED,
      externalId: `sim_${input.orderId}`,
      status: "PENDING"
    };
  }
}

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
};

type AsaasCustomerResponse = {
  id?: string;
  errors?: Array<{ description?: string }>;
};

type AsaasPaymentResponse = {
  id?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  status?: string;
  externalReference?: string;
  errors?: Array<{ description?: string }>;
};

export type AsaasPaymentStatusResponse = AsaasPaymentResponse;

type AsaasPixQrCodeResponse = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
  errors?: Array<{ description?: string }>;
};

export type AsaasSplit = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

function decimalEnv(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getAsaasSplits() {
  if (process.env.ASAAS_SPLIT_ENABLED !== "true") {
    return undefined;
  }

  const splits: AsaasSplit[] = [];

  for (let index = 1; index <= 10; index += 1) {
    const walletId = process.env[`ASAAS_SPLIT_WALLET_ID_${index}`];
    const fixedValue = decimalEnv(process.env[`ASAAS_SPLIT_FIXED_VALUE_${index}`]);
    const percentualValue = decimalEnv(process.env[`ASAAS_SPLIT_PERCENTUAL_VALUE_${index}`]);

    if (!walletId) {
      continue;
    }

    if (fixedValue === undefined && percentualValue === undefined) {
      continue;
    }

    splits.push({
      walletId,
      ...(fixedValue !== undefined ? { fixedValue } : {}),
      ...(percentualValue !== undefined ? { percentualValue } : {})
    });
  }

  return splits.length > 0 ? splits : undefined;
}

export class MercadoPagoCheckoutProProvider implements PaymentProvider {
  private readonly accessToken: string;
  private readonly appUrl: string;
  private readonly useSandboxUrl: boolean;

  constructor() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

    if (!accessToken) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
    }

    if (!appUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL ou APP_URL precisa ser configurado.");
    }

    this.accessToken = accessToken;
    this.appUrl = appUrl.replace(/\/$/, "");
    this.useSandboxUrl = process.env.MERCADO_PAGO_USE_SANDBOX_URL === "true";
  }

  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [
          {
            id: input.orderId,
            title: `Pedido ${input.orderCode} - ${input.eventTitle}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: input.amountInCents / 100
          }
        ],
        payer: {
          email: input.customerEmail
        },
        external_reference: input.orderCode,
        notification_url: `${this.appUrl}/api/webhooks/payments/mercado-pago`,
        back_urls: {
          success: `${this.appUrl}/pedido/${input.orderCode}`,
          pending: `${this.appUrl}/pedido/${input.orderCode}`,
          failure: `${this.appUrl}/pedido/${input.orderCode}`
        },
        auto_return: "approved",
        statement_descriptor: "TCR INGRESSOS",
        metadata: {
          order_id: input.orderId,
          order_code: input.orderCode,
          event_slug: input.eventSlug
        }
      })
    });

    const payload = (await response.json()) as MercadoPagoPreferenceResponse & { message?: string };

    if (!response.ok || !payload.id) {
      throw new Error(payload.message || "Nao foi possivel criar a preferencia no Mercado Pago.");
    }

    const checkoutUrl = this.useSandboxUrl ? payload.sandbox_init_point : payload.init_point;

    if (!checkoutUrl) {
      throw new Error("Mercado Pago nao retornou a URL de checkout.");
    }

    return {
      provider: PrismaPaymentProvider.MERCADO_PAGO,
      externalId: payload.id,
      checkoutUrl,
      status: "PENDING",
      rawPayload: payload
    };
  }

  async getPayment(paymentId: string): Promise<MercadoPagoPaymentResponse> {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    });

    const payload = (await response.json()) as MercadoPagoPaymentResponse & { message?: string };

    if (!response.ok) {
      throw new Error(payload.message || "Nao foi possivel consultar o pagamento no Mercado Pago.");
    }

    return payload;
  }
}

export class AsaasPaymentProvider implements PaymentProvider {
  private readonly apiUrl: string;
  private readonly accessToken: string;
  private readonly billingType: string;

  constructor() {
    const accessToken = process.env.ASAAS_API_KEY;

    if (!accessToken) {
      throw new Error("ASAAS_API_KEY nao configurado.");
    }

    this.accessToken = accessToken;
    this.apiUrl = (process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3").replace(/\/$/, "");
    this.billingType = process.env.ASAAS_BILLING_TYPE || "UNDEFINED";
  }

  private async request<T>(path: string, init: RequestInit) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        access_token: this.accessToken,
        "Content-Type": "application/json",
        ...(init.headers || {})
      }
    });

    const payload = (await response.json()) as T & { errors?: Array<{ description?: string }> };

    if (!response.ok) {
      const message = payload.errors?.map((error) => error.description).filter(Boolean).join(" ");
      throw new Error(message || "Erro na comunicacao com o Asaas.");
    }

    return payload;
  }

  private async createCustomer(input: PaymentIntentInput) {
    if (!input.customerDocument) {
      throw new Error("CPF/CNPJ do comprador e obrigatorio para pagamento via Asaas.");
    }

    return this.request<AsaasCustomerResponse>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.customerName,
        email: input.customerEmail,
        cpfCnpj: input.customerDocument.replace(/\D/g, ""),
        mobilePhone: input.customerPhone?.replace(/\D/g, "") || undefined,
        externalReference: input.orderCode,
        notificationDisabled: true
      })
    });
  }

  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const customer = await this.createCustomer(input);

    if (!customer.id) {
      throw new Error("Asaas nao retornou o cliente da cobranca.");
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const payment = await this.request<AsaasPaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: this.billingType,
        value: input.amountInCents / 100,
        dueDate: dueDate.toISOString().slice(0, 10),
        description: `Pedido ${input.orderCode} - ${input.eventTitle}`,
        externalReference: input.orderCode,
        split: input.split ?? getAsaasSplits()
      })
    });

    if (!payment.id) {
      throw new Error("Asaas nao retornou o pagamento criado.");
    }

    if (this.billingType === "PIX") {
      const pixQrCode = await this.request<AsaasPixQrCodeResponse>(`/payments/${payment.id}/pixQrCode`, {
        method: "GET"
      });

      if (!pixQrCode.encodedImage || !pixQrCode.payload) {
        throw new Error("Asaas nao retornou o QR Code Pix.");
      }

      return {
        provider: PrismaPaymentProvider.ASAAS,
        externalId: payment.id,
        pixQrCodeImage: pixQrCode.encodedImage,
        pixQrCodePayload: pixQrCode.payload,
        pixExpiresAt: pixQrCode.expirationDate ? new Date(pixQrCode.expirationDate) : undefined,
        status: "PENDING",
        rawPayload: {
          payment,
          pixQrCode
        }
      };
    }

    const checkoutUrl = payment.invoiceUrl || payment.bankSlipUrl;

    if (!checkoutUrl) {
      throw new Error("Asaas nao retornou uma URL de pagamento.");
    }

    return {
      provider: PrismaPaymentProvider.ASAAS,
      externalId: payment.id,
      checkoutUrl,
      status: "PENDING",
      rawPayload: payment
    };
  }

  async createCreditCardPayment(input: CreditCardPaymentInput): Promise<PaymentIntentResult> {
    const customer = await this.createCustomer(input);

    if (!customer.id) {
      throw new Error("Asaas nao retornou o cliente da cobranca.");
    }

    const dueDate = new Date();
    const sanitizedCardNumber = input.number.replace(/\D/g, "");
    const sanitizedCpfCnpj = input.holderCpfCnpj.replace(/\D/g, "");
    const sanitizedPhone = input.customerPhone?.replace(/\D/g, "");
    const paymentValue = input.amountInCents / 100;
    const installmentCount = input.installments > 1 ? input.installments : undefined;

    const payment = await this.request<AsaasPaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: "CREDIT_CARD",
        value: paymentValue,
        dueDate: dueDate.toISOString().slice(0, 10),
        description: `Pedido ${input.orderCode} - ${input.eventTitle}`,
        externalReference: input.orderCode,
        ...(installmentCount
          ? {
              installmentCount,
              installmentValue: Number((paymentValue / installmentCount).toFixed(2))
            }
          : {}),
        split: input.split ?? getAsaasSplits(),
        creditCard: {
          holderName: input.holderName,
          number: sanitizedCardNumber,
          expiryMonth: input.expiryMonth.padStart(2, "0"),
          expiryYear: input.expiryYear.length === 2 ? `20${input.expiryYear}` : input.expiryYear,
          ccv: input.ccv
        },
        creditCardHolderInfo: {
          name: input.holderName,
          email: input.customerEmail,
          cpfCnpj: sanitizedCpfCnpj,
          postalCode: input.holderPostalCode.replace(/\D/g, ""),
          addressNumber: input.holderAddressNumber,
          addressComplement: input.holderAddressComplement || undefined,
          phone: sanitizedPhone || undefined,
          mobilePhone: sanitizedPhone || undefined
        },
        remoteIp: input.remoteIp
      })
    });

    if (!payment.id) {
      throw new Error("Asaas nao retornou o pagamento no cartao.");
    }

    return {
      provider: PrismaPaymentProvider.ASAAS,
      externalId: payment.id,
      status: payment.status === "RECEIVED" || payment.status === "CONFIRMED" ? "APPROVED" : "PENDING",
      rawPayload: payment
    };
  }

  async getPayment(paymentId: string): Promise<AsaasPaymentStatusResponse> {
    return this.request<AsaasPaymentStatusResponse>(`/payments/${paymentId}`, {
      method: "GET"
    });
  }
}

export function getPaymentProvider() {
  const provider = process.env.PAYMENT_PROVIDER || "SIMULATED";

  if (provider === "MERCADO_PAGO") {
    return new MercadoPagoCheckoutProProvider();
  }

  if (provider === "ASAAS") {
    return new AsaasPaymentProvider();
  }

  return new SimulatedPaymentProvider();
}

export function getMercadoPagoProvider() {
  return new MercadoPagoCheckoutProProvider();
}

export function getAsaasProvider() {
  return new AsaasPaymentProvider();
}
