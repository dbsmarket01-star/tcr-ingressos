import { Prisma, WhatsAppMessageStatus, WhatsAppMessageType } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/request-host";

type WhatsAppTemplateParameter = {
  type: "text";
  text: string;
};

type WhatsAppTemplateButtonParameter = {
  type: "text";
  text: string;
};

type WhatsAppTemplateComponent =
  | {
      type: "body";
      parameters: WhatsAppTemplateParameter[];
    }
  | {
      type: "button";
      sub_type: "url";
      index: string;
      parameters: WhatsAppTemplateButtonParameter[];
    };

type SendTemplateMessageInput = {
  to?: string | null;
  templateName: string;
  parameters: string[];
  urlButtonParameter?: string;
  logContext?: WhatsAppLogContext;
};

type WhatsAppApiResponse = {
  messages?: Array<{
    id?: string;
  }>;
};

type WhatsAppApiErrorPayload = {
  error?: {
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    message?: string;
    type?: string;
  };
};

type WhatsAppLogContext = {
  organizationId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
  leadId?: string | null;
  type?: WhatsAppMessageType;
  recipientName?: string | null;
};

export type CartAbandonmentWhatsAppInput = {
  buyerName: string;
  buyerPhone?: string | null;
  eventTitle: string;
  cartSummary?: string;
  orderCode?: string;
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

export function verifyWhatsAppMetaSignature(rawBody: string, signature?: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

  if (!appSecret) {
    return true;
  }

  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signature.slice("sha256=".length);

  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

function getTemplateName(envName: string, fallback: string) {
  return process.env[envName]?.trim() || fallback;
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

function parseWhatsAppApiError(detail: string) {
  try {
    const json = JSON.parse(detail) as WhatsAppApiErrorPayload;
    const error = json.error;

    if (!error) {
      return {
        message: detail,
        payload: json
      };
    }

    const pieces = [
      error.message,
      error.code ? `code ${error.code}` : null,
      error.error_subcode ? `subcode ${error.error_subcode}` : null,
      error.fbtrace_id ? `trace ${error.fbtrace_id}` : null
    ].filter(Boolean);

    return {
      message: pieces.join(" | ") || detail,
      payload: json
    };
  } catch {
    return {
      message: detail,
      payload: detail
    };
  }
}

async function recordWhatsAppMessageLog(input: {
  to?: string | null;
  templateName?: string | null;
  parameters?: string[];
  textContent?: string | null;
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
          : input.textContent
            ? toJson({
                text: input.textContent
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

async function getDefaultWhatsAppOrganizationId() {
  const hosts = [
    normalizeHost(process.env.APP_URL),
    normalizeHost(process.env.NEXT_PUBLIC_APP_URL),
    normalizeHost(process.env.ADMIN_HOST)
  ].filter(Boolean) as string[];

  if (hosts.length === 0) {
    return null;
  }

  const organization = await prisma.organization.findFirst({
    where: {
      isActive: true,
      OR: [
        {
          publicDomain: {
            in: hosts
          }
        },
        {
          adminDomain: {
            in: hosts
          }
        }
      ]
    },
    select: {
      id: true
    }
  });

  return organization?.id ?? null;
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

    if (input.urlButtonParameter) {
      components.push({
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [
          {
            type: "text",
            text: input.urlButtonParameter
          }
        ]
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/${getWhatsAppApiVersion()}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
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
      const detail = await response.text().catch(() => "");
      const parsedError = parseWhatsAppApiError(detail);

      throw Object.assign(new Error(parsedError.message || `WhatsApp API retornou HTTP ${response.status}.`), {
        providerPayload: parsedError.payload
      });
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
      errorMessage: normalizeError(error),
      webhookPayload:
        error instanceof Error && "providerPayload" in error
          ? (error as Error & { providerPayload?: unknown }).providerPayload
          : undefined
    });

    throw error;
  }
}

export async function sendCartAbandonmentWhatsApp(input: CartAbandonmentWhatsAppInput) {
  const minutesRemaining = Math.max(0, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60000));
  const templateName = getTemplateName("WHATSAPP_CART_ABANDONMENT_TEMPLATE_NAME", "abandono_carrinho");

  if (templateName === "abandono_carrinho_tcr_botao_v1" || templateName === "abandono_carrinho_tcr_botao_v2") {
    return sendTemplateMessage({
      to: input.buyerPhone,
      templateName,
      parameters: [input.buyerName, input.cartSummary || "ingressos selecionados", input.eventTitle],
      urlButtonParameter: input.orderCode,
      logContext: {
        type: WhatsAppMessageType.CART_ABANDONMENT,
        organizationId: input.organizationId,
        eventId: input.eventId,
        orderId: input.orderId,
        recipientName: input.buyerName
      }
    });
  }

  return sendTemplateMessage({
    to: input.buyerPhone,
    templateName,
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

export async function sendWhatsAppTextMessage(input: {
  to?: string | null;
  text: string;
  organizationId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
  leadId?: string | null;
  recipientName?: string | null;
}) {
  let to = input.to || null;
  const config = getWhatsAppConfig();

  try {
    if (!config.token || !config.phoneNumberId) {
      throw new Error("WhatsApp Business API nao configurada.");
    }

    const text = input.text.trim();

    if (!text) {
      throw new Error("Mensagem nao informada.");
    }

    to = formatPhone(input.to);
    const response = await fetch(
      `https://graph.facebook.com/${getWhatsAppApiVersion()}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            preview_url: true,
            body: text
          }
        })
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const parsedError = parseWhatsAppApiError(detail);

      throw Object.assign(new Error(parsedError.message || `WhatsApp API retornou HTTP ${response.status}.`), {
        providerPayload: parsedError.payload
      });
    }

    const payload = (await response.json()) as WhatsAppApiResponse;
    await recordWhatsAppMessageLog({
      to,
      textContent: text,
      context: {
        type: WhatsAppMessageType.BULK,
        organizationId: input.organizationId,
        eventId: input.eventId,
        orderId: input.orderId,
        leadId: input.leadId,
        recipientName: input.recipientName
      },
      status: WhatsAppMessageStatus.SENT,
      providerMessageId: extractProviderMessageId(payload)
    });

    return payload;
  } catch (error) {
    await recordWhatsAppMessageLog({
      to,
      textContent: input.text,
      context: {
        type: WhatsAppMessageType.BULK,
        organizationId: input.organizationId,
        eventId: input.eventId,
        orderId: input.orderId,
        leadId: input.leadId,
        recipientName: input.recipientName
      },
      status: WhatsAppMessageStatus.FAILED,
      errorMessage: normalizeError(error),
      webhookPayload:
        error instanceof Error && "providerPayload" in error
          ? (error as Error & { providerPayload?: unknown }).providerPayload
          : undefined
    });

    throw error;
  }
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
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
        statuses?: WhatsAppWebhookStatus[];
      };
    }>;
  }>;
};

export async function handleWhatsAppMetaWebhook(payload: unknown) {
  const body = payload as WhatsAppWebhookPayload;
  const statuses =
    body.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.statuses || []) || []) || [];
  const messages =
    body.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages || []) || []) || [];
  let updated = 0;
  let received = 0;
  const organizationId = messages.length > 0 ? await getDefaultWhatsAppOrganizationId() : null;

  for (const message of messages) {
    if (message.id) {
      const existingMessage = await prisma.whatsAppMessageLog.findFirst({
        where: {
          providerMessageId: message.id
        },
        select: {
          id: true
        }
      });

      if (existingMessage) {
        continue;
      }
    }

    await recordWhatsAppMessageLog({
      to: message.from,
      textContent: message.text?.body || null,
      context: {
        type: WhatsAppMessageType.WEBHOOK,
        organizationId
      },
      status: WhatsAppMessageStatus.RECEIVED,
      providerMessageId: message.id,
      webhookPayload: message
    });
    received += 1;
  }

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
    received: statuses.length + messages.length,
    updated,
    created: received
  };
}
