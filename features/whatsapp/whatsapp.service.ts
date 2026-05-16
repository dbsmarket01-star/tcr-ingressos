import { Prisma, WhatsAppMessageStatus, WhatsAppMessageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type WhatsAppTemplateParameter = {
  type: "text";
  text: string;
};

type WhatsAppTemplateComponent = {
  type: "body";
  parameters: WhatsAppTemplateParameter[];
};

type SendTemplateMessageInput = {
  to?: string | null;
  templateName: string;
  parameters: string[];
  logContext?: WhatsAppLogContext;
};

type WhatsAppApiResponse = {
  messages?: Array<{
    id?: string;
  }>;
};

type WhatsAppLogContext = {
  organizationId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
  leadId?: string | null;
  type?: WhatsAppMessageType;
  recipientName?: string | null;
};

export type PurchaseApprovedWhatsAppInput = {
  buyerName: string;
  buyerPhone?: string | null;
  eventTitle: string;
  orderCode: string;
  orderUrl: string;
  organizationId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
};

export type CartAbandonmentWhatsAppInput = {
  buyerName: string;
  buyerPhone?: string | null;
  eventTitle: string;
  orderUrl: string;
  expiresAt: Date;
  organizationId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
};

export type BulkWhatsAppRecipient = {
  id?: string;
  name: string;
  phone?: string | null;
};

export type BulkWhatsAppOptions = {
  organizationId?: string | null;
  eventId?: string | null;
};

export type BulkWhatsAppResult = {
  sent: number;
  failed: number;
  results: Array<{
    phone?: string | null;
    name: string;
    ok: boolean;
    error?: string;
  }>;
};

function getWhatsAppApiVersion() {
  return process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v19.0";
}

function getWhatsAppConfig() {
  return {
    token: process.env.WHATSAPP_API_TOKEN?.trim(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  };
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function extractProviderMessageId(response: WhatsAppApiResponse) {
  return response.messages?.find((message) => message.id)?.id ?? null;
}

async function recordWhatsAppMessageLog(input: {
  to?: string | null;
  templateName?: string | null;
  parameters?: string[];
  context?: WhatsAppLogContext;
  status: WhatsAppMessageStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  webhookPayload?: unknown;
}) {
  const now = new Date();

  await prisma.whatsAppMessageLog
    .create({
      data: {
        organizationId: input.context?.organizationId || null,
        eventId: input.context?.eventId || null,
        orderId: input.context?.orderId || null,
        leadId: input.context?.leadId || null,
        type: input.context?.type || WhatsAppMessageType.BULK,
        status: input.status,
        templateName: input.templateName || null,
        recipientName: input.context?.recipientName || null,
        recipientPhone: input.to || null,
        providerMessageId: input.providerMessageId || null,
        errorMessage: input.errorMessage || null,
        payload: input.templateName
          ? toJson({
              templateName: input.templateName,
              parameters: input.parameters || []
            })
          : undefined,
        webhookPayload: input.webhookPayload ? toJson(input.webhookPayload) : undefined,
        sentAt: input.status === WhatsAppMessageStatus.SENT ? now : null,
        deliveredAt: input.status === WhatsAppMessageStatus.DELIVERED ? now : null,
        readAt: input.status === WhatsAppMessageStatus.READ ? now : null,
        failedAt: input.status === WhatsAppMessageStatus.FAILED ? now : null
      }
    })
    .catch((error) => {
      console.error("[WhatsApp] Falha ao registrar log de mensagem", {
        templateName: input.templateName,
        status: input.status,
        error: normalizeError(error)
      });
    });
}

export function isWhatsAppConfigured() {
  const config = getWhatsAppConfig();
  return Boolean(config.token && config.phoneNumberId);
}

export function formatPhone(phone?: string | null) {
  const digits = String(phone ?? "").replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) {
    throw new Error("Telefone do WhatsApp nao informado.");
  }

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  throw new Error("Telefone do WhatsApp invalido.");
}

async function sendTemplateMessage(input: SendTemplateMessageInput) {
  let to = input.to || null;

  const config = getWhatsAppConfig();

  try {
    if (!config.token || !config.phoneNumberId) {
      throw new Error("WhatsApp Business API nao configurada.");
    }

    to = formatPhone(input.to);
    const parameters: WhatsAppTemplateParameter[] = input.parameters.map((parameter) => ({
      type: "text",
      text: parameter
    }));
    const components: WhatsAppTemplateComponent[] = [
      {
        type: "body",
        parameters
      }
    ];
    const response = await fetch(
      `https://graph.facebook.com/${getWhatsAppApiVersion()}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: input.templateName,
            language: {
              code: "pt_BR"
            },
            components
          }
        })
      }
    );

    if (!response.ok) {
      let detail = await response.text().catch(() => "");

      try {
        const json = JSON.parse(detail) as { error?: { message?: string } };
        detail = json.error?.message || detail;
      } catch {
        // Mantem o texto bruto do provedor.
      }

      throw new Error(detail || `WhatsApp API retornou HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as WhatsAppApiResponse;
    await recordWhatsAppMessageLog({
      to,
      templateName: input.templateName,
      parameters: input.parameters,
      context: input.logContext,
      status: WhatsAppMessageStatus.SENT,
      providerMessageId: extractProviderMessageId(payload)
    });

    return payload;
  } catch (error) {
    await recordWhatsAppMessageLog({
      to,
      templateName: input.templateName,
      parameters: input.parameters,
      context: input.logContext,
      status: WhatsAppMessageStatus.FAILED,
      errorMessage: normalizeError(error)
    });

    throw error;
  }
}

export async function sendPurchaseApprovedWhatsApp(input: PurchaseApprovedWhatsAppInput) {
  return sendTemplateMessage({
    to: input.buyerPhone,
    templateName: "compra_aprovada",
    parameters: [input.buyerName, input.eventTitle, input.orderCode, input.orderUrl],
    logContext: {
      type: WhatsAppMessageType.PURCHASE_APPROVED,
      organizationId: input.organizationId,
      eventId: input.eventId,
      orderId: input.orderId,
      recipientName: input.buyerName
    }
  });
}

export async function sendCartAbandonmentWhatsApp(input: CartAbandonmentWhatsAppInput) {
  const minutesRemaining = Math.max(0, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60000));

  return sendTemplateMessage({
    to: input.buyerPhone,
    templateName: "abandono_carrinho",
    parameters: [input.buyerName, input.eventTitle, String(minutesRemaining), input.orderUrl],
    logContext: {
      type: WhatsAppMessageType.CART_ABANDONMENT,
      organizationId: input.organizationId,
      eventId: input.eventId,
      orderId: input.orderId,
      recipientName: input.buyerName
    }
  });
}

export async function sendBulkWhatsApp<TRecipient extends BulkWhatsAppRecipient>(
  recipients: TRecipient[],
  templateName: string,
  buildParameters: (recipient: TRecipient) => string[],
  options?: BulkWhatsAppOptions
): Promise<BulkWhatsAppResult> {
  const result: BulkWhatsAppResult = {
    sent: 0,
    failed: 0,
    results: []
  };

  for (const recipient of recipients) {
    try {
      await sendTemplateMessage({
        to: recipient.phone,
        templateName,
        parameters: buildParameters(recipient),
        logContext: {
          type: WhatsAppMessageType.BULK,
          organizationId: options?.organizationId,
          eventId: options?.eventId,
          leadId: recipient.id,
          recipientName: recipient.name
        }
      });

      result.sent += 1;
      result.results.push({
        name: recipient.name,
        phone: recipient.phone,
        ok: true
      });
    } catch (error) {
      result.failed += 1;
      result.results.push({
        name: recipient.name,
        phone: recipient.phone,
        ok: false,
        error: normalizeError(error)
      });
      console.error("[WhatsApp] Falha no disparo em massa", {
        name: recipient.name,
        phone: recipient.phone,
        templateName,
        error: normalizeError(error)
      });
    }

    await wait(100);
  }

  return result;
}

function mapWebhookStatus(status?: string) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "delivered") {
    return WhatsAppMessageStatus.DELIVERED;
  }

  if (normalized === "read") {
    return WhatsAppMessageStatus.READ;
  }

  if (normalized === "failed") {
    return WhatsAppMessageStatus.FAILED;
  }

  return WhatsAppMessageStatus.SENT;
}

function dateFromMetaTimestamp(timestamp?: string) {
  const seconds = Number(timestamp);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date();
  }

  return new Date(seconds * 1000);
}

function extractErrorMessage(status: WhatsAppWebhookStatus) {
  return status.errors?.map((error) => error.message || error.title || error.code).filter(Boolean).join("; ") || null;
}

type WhatsAppWebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{
    code?: string | number;
    title?: string;
    message?: string;
  }>;
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: WhatsAppWebhookStatus[];
      };
    }>;
  }>;
};

export async function handleWhatsAppMetaWebhook(payload: unknown) {
  const body = payload as WhatsAppWebhookPayload;
  const statuses =
    body.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.statuses || []) || []) || [];
  let updated = 0;
  let received = 0;

  for (const status of statuses) {
    const providerMessageId = status.id;
    const mappedStatus = mapWebhookStatus(status.status);
    const eventDate = dateFromMetaTimestamp(status.timestamp);
    const errorMessage = extractErrorMessage(status);
    const data: Prisma.WhatsAppMessageLogUpdateManyMutationInput = {
      status: mappedStatus,
      webhookPayload: toJson(status),
      ...(mappedStatus === WhatsAppMessageStatus.SENT ? { sentAt: eventDate } : {}),
      ...(mappedStatus === WhatsAppMessageStatus.DELIVERED ? { deliveredAt: eventDate } : {}),
      ...(mappedStatus === WhatsAppMessageStatus.READ ? { readAt: eventDate } : {}),
      ...(mappedStatus === WhatsAppMessageStatus.FAILED ? { failedAt: eventDate, errorMessage } : {})
    };

    if (!providerMessageId) {
      received += 1;
      await recordWhatsAppMessageLog({
        to: status.recipient_id,
        context: {
          type: WhatsAppMessageType.WEBHOOK
        },
        status: mappedStatus,
        errorMessage,
        webhookPayload: status
      });
      continue;
    }

    const result = await prisma.whatsAppMessageLog.updateMany({
      where: {
        providerMessageId
      },
      data
    });

    if (result.count === 0) {
      await recordWhatsAppMessageLog({
        to: status.recipient_id,
        context: {
          type: WhatsAppMessageType.WEBHOOK
        },
        status: mappedStatus,
        providerMessageId,
        errorMessage,
        webhookPayload: status
      });
      received += 1;
    } else {
      updated += result.count;
    }
  }

  return {
    received: statuses.length,
    updated,
    created: received
  };
}
