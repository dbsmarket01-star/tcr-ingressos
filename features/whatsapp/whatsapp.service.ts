import { Prisma, WhatsAppMessageStatus, WhatsAppMessageType } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/request-host";
import { savePublicMediaUpload } from "@/features/uploads/local-upload.service";

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
  payloadMetadata?: Record<string, unknown>;
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
              parameters: input.parameters || [],
              ...(input.payloadMetadata || {})
            })
          : input.textContent || input.payloadMetadata
            ? toJson({
                ...(input.textContent ? { text: input.textContent } : {}),
                ...(input.payloadMetadata || {})
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
  const formattedPhone = formatPhone(input.buyerPhone);
  const phoneWithoutCountry = formattedPhone.startsWith("55") ? formattedPhone.slice(2) : formattedPhone;
  const phoneCandidates = Array.from(new Set([formattedPhone, phoneWithoutCountry, `55${phoneWithoutCountry}`]));
  const recentAbandonment = await prisma.whatsAppMessageLog.findFirst({
    where: {
      type: WhatsAppMessageType.CART_ABANDONMENT,
      status: {
        in: [WhatsAppMessageStatus.SENT, WhatsAppMessageStatus.DELIVERED, WhatsAppMessageStatus.READ]
      },
      recipientPhone: {
        in: phoneCandidates
      },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      ...(input.organizationId ? { organizationId: input.organizationId } : {})
    },
    select: {
      id: true,
      createdAt: true
    }
  });

  if (recentAbandonment) {
    return {
      skipped: true as const,
      reason: "RECENT_CART_ABANDONMENT",
      previousMessageAt: recentAbandonment.createdAt
    };
  }

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
  source?: string;
  metadata?: Record<string, unknown>;
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
      providerMessageId: extractProviderMessageId(payload),
      payloadMetadata: {
        ...(input.source ? { source: input.source } : {}),
        ...(input.metadata || {})
      }
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
      payloadMetadata: {
        ...(input.source ? { source: input.source } : {}),
        ...(input.metadata || {})
      },
      webhookPayload:
        error instanceof Error && "providerPayload" in error
          ? (error as Error & { providerPayload?: unknown }).providerPayload
          : undefined
    });

    throw error;
  }
}

export type WhatsAppMediaKind = "audio" | "document" | "image" | "video";

export async function sendWhatsAppMediaMessage(input: {
  to?: string | null;
  kind: WhatsAppMediaKind;
  mediaUrl: string;
  fileName?: string | null;
  caption?: string | null;
  mimeType?: string | null;
  organizationId?: string | null;
  eventId?: string | null;
  orderId?: string | null;
  leadId?: string | null;
  recipientName?: string | null;
}) {
  const config = getWhatsAppConfig();
  let to = input.to || null;
  try {
    if (!config.token || !config.phoneNumberId) throw new Error("WhatsApp Business API nao configurada.");
    to = formatPhone(input.to);
    const media: Record<string, string> = { link: input.mediaUrl };
    if (input.caption && input.kind !== "audio") media.caption = input.caption;
    if (input.fileName && input.kind === "document") media.filename = input.fileName;
    const response = await fetch(`https://graph.facebook.com/${getWhatsAppApiVersion()}/${config.phoneNumberId}/messages`, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: input.kind, [input.kind]: media })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const parsedError = parseWhatsAppApiError(detail);
      throw Object.assign(new Error(parsedError.message || `WhatsApp API retornou HTTP ${response.status}.`), { providerPayload: parsedError.payload });
    }
    const payload = (await response.json()) as WhatsAppApiResponse;
    await recordWhatsAppMessageLog({
      to,
      textContent: input.caption || null,
      context: { type: WhatsAppMessageType.BULK, organizationId: input.organizationId, eventId: input.eventId, orderId: input.orderId, leadId: input.leadId, recipientName: input.recipientName },
      status: WhatsAppMessageStatus.SENT,
      providerMessageId: extractProviderMessageId(payload),
      payloadMetadata: { media: { kind: input.kind, url: input.mediaUrl, fileName: input.fileName || null, mimeType: input.mimeType || null } }
    });
    return payload;
  } catch (error) {
    await recordWhatsAppMessageLog({
      to,
      textContent: input.caption || null,
      context: { type: WhatsAppMessageType.BULK, organizationId: input.organizationId, eventId: input.eventId, orderId: input.orderId, leadId: input.leadId, recipientName: input.recipientName },
      status: WhatsAppMessageStatus.FAILED,
      errorMessage: normalizeError(error),
      payloadMetadata: { media: { kind: input.kind, url: input.mediaUrl, fileName: input.fileName || null, mimeType: input.mimeType || null } },
      webhookPayload: error instanceof Error && "providerPayload" in error ? (error as Error & { providerPayload?: unknown }).providerPayload : undefined
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

type WhatsAppInboundMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string; sha256?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean; sha256?: string };
  video?: { id?: string; mime_type?: string; caption?: string; sha256?: string };
  document?: { id?: string; mime_type?: string; caption?: string; filename?: string; sha256?: string };
  sticker?: { id?: string; mime_type?: string; animated?: boolean; sha256?: string };
  reaction?: { message_id?: string; emoji?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: Array<{ name?: { formatted_name?: string }; phones?: Array<{ phone?: string; wa_id?: string }> }>;
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string; id?: string }; list_reply?: { title?: string; description?: string; id?: string } };
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppInboundMessage[];
        statuses?: WhatsAppWebhookStatus[];
      };
    }>;
  }>;
};

function inboundMedia(message: WhatsAppInboundMessage) {
  for (const kind of ["image", "audio", "video", "document", "sticker"] as const) {
    const data = message[kind];
    if (data?.id) return { kind, data };
  }
  return null;
}

async function downloadInboundWhatsAppMedia(message: WhatsAppInboundMessage) {
  const media = inboundMedia(message);
  const token = getWhatsAppConfig().token;
  if (!media || !token) return null;
  try {
    const metadataResponse = await fetch(`https://graph.facebook.com/${getWhatsAppApiVersion()}/${media.data.id}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000), cache: "no-store"
    });
    if (!metadataResponse.ok) throw new Error(`Meta media metadata HTTP ${metadataResponse.status}`);
    const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string };
    if (!metadata.url) throw new Error("Meta não retornou a URL da mídia.");
    const mediaResponse = await fetch(metadata.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!mediaResponse.ok) throw new Error(`Meta media download HTTP ${mediaResponse.status}`);
    const mimeType = media.data.mime_type || metadata.mime_type || mediaResponse.headers.get("content-type") || "application/octet-stream";
    const fileName = "filename" in media.data && media.data.filename ? media.data.filename : `whatsapp-${media.kind}`;
    const file = new File([await mediaResponse.arrayBuffer()], fileName, { type: mimeType });
    const url = await savePublicMediaUpload(file, `whatsapp/inbound/${new Date().toISOString().slice(0, 10)}`);
    return { kind: media.kind, url, fileName, mimeType, caption: "caption" in media.data ? media.data.caption || null : null };
  } catch (error) {
    console.error("[WhatsApp] Falha ao preservar mídia recebida", { mediaId: media.data.id, kind: media.kind, error: normalizeError(error) });
    return { kind: media.kind, url: null, fileName: "filename" in media.data ? media.data.filename || null : null, mimeType: media.data.mime_type || null, error: normalizeError(error) };
  }
}

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

    const media = await downloadInboundWhatsAppMedia(message);
    const reactionText = message.reaction?.emoji ? `Reagiu ${message.reaction.emoji}` : null;
    await recordWhatsAppMessageLog({
      to: message.from,
      textContent: message.text?.body || reactionText || media?.caption || null,
      context: {
        type: WhatsAppMessageType.WEBHOOK,
        organizationId
      },
      status: WhatsAppMessageStatus.RECEIVED,
      providerMessageId: message.id,
      webhookPayload: media ? { ...message, _tcrMedia: media } : message
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
