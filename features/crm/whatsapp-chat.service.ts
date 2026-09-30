import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveWhatsAppAiConversationMode } from "@/features/ai/whatsapp-support-ai.service";

type EventScope = string[] | null | undefined;

const KNOWN_WHATSAPP_TYPES = ["PURCHASE_APPROVED", "CART_ABANDONMENT", "BULK", "WEBHOOK"] as const;

export async function getCrmWhatsAppNotificationSnapshot(input: {
  organizationId: string;
  allowedEventIds?: EventScope;
}) {
  // This endpoint is polled frequently by the operator console. Keep it to one
  // indexed row instead of rebuilding the complete CRM inbox (messages,
  // orders, audit logs and AI state) on every poll.
  const latestInbound = await prisma.whatsAppMessageLog.findFirst({
    where: {
      organizationId: input.organizationId,
      status: "RECEIVED",
      ...(input.allowedEventIds ? { eventId: { in: input.allowedEventIds } } : {})
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      recipientName: true,
      recipientPhone: true,
      payload: true,
      webhookPayload: true,
      createdAt: true,
      status: true,
      templateName: true
    }
  });

  return latestInbound
    ? {
        id: latestInbound.id,
        at: latestInbound.createdAt,
        name: latestInbound.recipientName || "Contato",
        message: messageContent(latestInbound),
        phone: latestInbound.recipientPhone
      }
    : null;
}

function normalizeDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function candidatePhones(value?: string | null) {
  const digits = normalizeDigits(value);

  if (!digits) {
    return [];
  }

  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  return Array.from(
    new Set([digits, `+${digits}`, `55${withoutCountry}`, `+55${withoutCountry}`, withoutCountry].filter(Boolean))
  );
}

function conversationPhoneKey(value?: string | null) {
  const digits = normalizeDigits(value);
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

function textFromPayload(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as { body?: unknown; text?: unknown };

  if (typeof data.text === "string") {
    return data.text;
  }

  if (data.text && typeof data.text === "object" && !Array.isArray(data.text)) {
    const body = (data.text as { body?: unknown }).body;

    if (typeof body === "string") {
      return body;
    }
  }

  return typeof data.body === "string" ? data.body : null;
}

function payloadSource(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const source = (payload as { source?: unknown }).source;
  return typeof source === "string" ? source : null;
}

function templatePreview(payload: Prisma.JsonValue | null | undefined, templateName?: string | null) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return templateName ? `Template: ${templateName}` : "Mensagem enviada";
  }

  const parameters = (payload as { parameters?: unknown }).parameters;

  if (Array.isArray(parameters) && parameters.length > 0) {
    const [name, cartSummary, eventTitle] = parameters.map(String);

    if (templateName?.startsWith("abandono_carrinho_tcr_botao") && name && cartSummary && eventTitle) {
      return `Olá, ${name}, aqui é da TCR Ingressos.\n\nVimos que você adicionou ao carrinho ${cartSummary} para o evento ${eventTitle}.\n\nEstou aqui para tirar qualquer dúvida que você tenha.`;
    }

    return parameters.map(String).join(" | ");
  }

  return templateName ? `Template: ${templateName}` : "Mensagem enviada";
}

type ChatMedia = { kind: string; url: string | null; fileName: string | null; mimeType: string | null; caption: string | null };

function mediaFromPayload(payload: Prisma.JsonValue | null | undefined): ChatMedia | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const object = payload as Record<string, unknown>;
  const candidate = object.media || object._tcrMedia;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    for (const kind of ["image", "audio", "video", "document", "sticker"]) {
      const raw = object[kind];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const media = raw as Record<string, unknown>;
      if (typeof media.id !== "string" || !media.id) continue;
      return {
        kind,
        url: `/api/admin/crm/whatsapp/media/${encodeURIComponent(media.id)}`,
        fileName: typeof media.filename === "string" ? media.filename : null,
        mimeType: typeof media.mime_type === "string" ? media.mime_type : null,
        caption: typeof media.caption === "string" ? media.caption : null
      };
    }
    return null;
  }
  const media = candidate as Record<string, unknown>;
  return {
    kind: typeof media.kind === "string" ? media.kind : "document",
    url: typeof media.url === "string" ? media.url : null,
    fileName: typeof media.fileName === "string" ? media.fileName : null,
    mimeType: typeof media.mimeType === "string" ? media.mimeType : null,
    caption: typeof media.caption === "string" ? media.caption : null
  };
}

function webhookFallbackContent(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const reaction = data.reaction;
  if (reaction && typeof reaction === "object" && !Array.isArray(reaction)) {
    const emoji = (reaction as { emoji?: unknown }).emoji;
    return typeof emoji === "string" && emoji ? `Reagiu ${emoji}` : "Removeu uma reação";
  }
  const location = data.location;
  if (location && typeof location === "object" && !Array.isArray(location)) {
    const value = location as { latitude?: unknown; longitude?: unknown; name?: unknown; address?: unknown };
    const label = [value.name, value.address].filter((part): part is string => typeof part === "string" && Boolean(part)).join(" — ");
    const coordinates = typeof value.latitude === "number" && typeof value.longitude === "number" ? `https://maps.google.com/?q=${value.latitude},${value.longitude}` : "";
    return `📍 ${label || "Localização compartilhada"}${coordinates ? `\n${coordinates}` : ""}`;
  }
  const contacts = data.contacts;
  if (Array.isArray(contacts) && contacts.length) {
    return contacts.map((contact) => {
      if (!contact || typeof contact !== "object" || Array.isArray(contact)) return "👤 Contato compartilhado";
      const item = contact as { name?: { formatted_name?: unknown }; phones?: Array<{ phone?: unknown; wa_id?: unknown }> };
      const name = typeof item.name?.formatted_name === "string" ? item.name.formatted_name : "Contato compartilhado";
      const phones = (item.phones || []).map((phone) => typeof phone.phone === "string" ? phone.phone : typeof phone.wa_id === "string" ? phone.wa_id : "").filter(Boolean).join(", ");
      return `👤 ${name}${phones ? ` — ${phones}` : ""}`;
    }).join("\n");
  }
  const button = data.button;
  if (button && typeof button === "object" && !Array.isArray(button) && typeof (button as { text?: unknown }).text === "string") return String((button as { text: string }).text);
  const interactive = data.interactive;
  if (interactive && typeof interactive === "object" && !Array.isArray(interactive)) {
    const item = interactive as { button_reply?: { title?: unknown }; list_reply?: { title?: unknown; description?: unknown } };
    if (typeof item.button_reply?.title === "string") return item.button_reply.title;
    if (typeof item.list_reply?.title === "string") return [item.list_reply.title, typeof item.list_reply.description === "string" ? item.list_reply.description : ""].filter(Boolean).join(" — ");
  }
  const labels: Record<string, string> = { image: "📷 Imagem", audio: "🎤 Áudio", video: "🎥 Vídeo", document: "📎 Documento", sticker: "🏷️ Figurinha", location: "📍 Localização", contacts: "👤 Contato compartilhado", button: "Resposta de botão", interactive: "Resposta interativa" };
  const type = typeof data.type === "string" ? data.type : "";
  return labels[type] || (type ? `Mensagem do tipo ${type}` : null);
}

function messageContent(message: {
  status: string;
  templateName: string | null;
  payload: Prisma.JsonValue | null;
  webhookPayload: Prisma.JsonValue | null;
}) {
  return (
    textFromPayload(message.payload) ||
    textFromPayload(message.webhookPayload) ||
    mediaFromPayload(message.payload)?.caption ||
    mediaFromPayload(message.webhookPayload)?.caption ||
    webhookFallbackContent(message.webhookPayload) ||
    templatePreview(message.payload, message.templateName)
  );
}

type InboxResult = Awaited<ReturnType<typeof loadCrmWhatsAppInbox>>;
const inboxCache = new Map<string, { expiresAt: number; promise: Promise<InboxResult> }>();
// O monitor consulta a cada segundo. Um cache maior fazia a API detectar o
// webhook, mas manter a lista antiga por alguns segundos.
const INBOX_CACHE_MS = 750;

async function loadCrmWhatsAppInbox(input: {
  organizationId: string;
  allowedEventIds?: EventScope;
  search?: string;
  startAt?: Date;
  endAt?: Date;
}) {
  const scopedOutbound = await prisma.whatsAppMessageLog.findMany({
    where: {
      organizationId: input.organizationId,
      type: {
        in: [...KNOWN_WHATSAPP_TYPES]
      },
      ...(input.startAt || input.endAt
        ? {
            createdAt: {
              ...(input.startAt ? { gte: input.startAt } : {}),
              ...(input.endAt ? { lt: input.endAt } : {})
            }
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      orderId: true,
      eventId: true,
      recipientName: true,
      recipientPhone: true,
      type: true,
      status: true,
      templateName: true,
      payload: true,
      webhookPayload: true,
      createdAt: true
    }
  });
  const orderIds = Array.from(new Set(scopedOutbound.map((message) => message.orderId).filter(Boolean))) as string[];
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: {
          id: { in: orderIds },
          event: {
            organizationId: input.organizationId,
            ...(input.allowedEventIds ? { id: { in: input.allowedEventIds } } : {})
          }
        },
        select: {
          id: true,
          code: true,
          status: true,
          customer: { select: { name: true, phone: true } },
          event: { select: { id: true, title: true } }
        }
      })
    : [];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const loggedPhoneCandidates = Array.from(
    new Set(scopedOutbound.flatMap((message) => candidatePhones(message.recipientPhone)))
  );
  const phoneOrders = loggedPhoneCandidates.length
    ? await prisma.order.findMany({
        where: {
          customer: { phone: { in: loggedPhoneCandidates } },
          event: {
            organizationId: input.organizationId,
            ...(input.allowedEventIds ? { id: { in: input.allowedEventIds } } : {})
          }
        },
        orderBy: { createdAt: "desc" },
        select: {
          code: true,
          status: true,
          customer: { select: { name: true, phone: true } },
          event: { select: { title: true } }
        }
      })
    : [];
  const orderByPhone = new Map<string, (typeof phoneOrders)[number]>();
  for (const order of phoneOrders) {
    const key = conversationPhoneKey(order.customer.phone);
    if (key && !orderByPhone.has(key)) orderByPhone.set(key, order);
  }
  const aiStateLogs = await prisma.adminAuditLog.findMany({
    where: {
      entityType: "WHATSAPP_CONVERSATION",
      entityId: { startsWith: `${input.organizationId}:` },
      action: { in: ["WHATSAPP_AI_ENABLED", "WHATSAPP_AI_PAUSED", "WHATSAPP_AI_HANDOFF"] }
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, entityId: true, metadata: true }
  });
  const aiModeByPhone = new Map<string, "ACTIVE" | "PAUSED" | "HANDOFF">();
  for (const log of aiStateLogs) {
    if (!log.entityId) continue;
    const key = log.entityId.slice(`${input.organizationId}:`.length);
    if (!key || aiModeByPhone.has(key)) continue;
    aiModeByPhone.set(key, resolveWhatsAppAiConversationMode({ action: log.action, metadata: log.metadata }));
  }
  const workflowLogs = await prisma.adminAuditLog.findMany({
    where: {
      entityType: "WHATSAPP_CONVERSATION",
      entityId: { startsWith: `${input.organizationId}:` },
      action: { in: ["WHATSAPP_CONVERSATION_READ", "WHATSAPP_FOLLOWUP_ENABLED", "WHATSAPP_FOLLOWUP_DISABLED", "WHATSAPP_CONVERSATION_HIDDEN"] }
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, entityId: true, metadata: true, createdAt: true }
  });
  const latestReadAtByPhone = new Map<string, Date>();
  const hasEverBeenRead = new Set<string>();
  const followUpByPhone = new Map<string, boolean>();
  const hiddenPhones = new Set<string>();
  for (const log of workflowLogs) {
    if (!log.entityId) continue;
    const key = log.entityId.slice(`${input.organizationId}:`.length);
    if (!key) continue;
    if (log.action === "WHATSAPP_CONVERSATION_READ") {
      hasEverBeenRead.add(key);
      if (!latestReadAtByPhone.has(key)) latestReadAtByPhone.set(key, log.createdAt);
    }
    if ((log.action === "WHATSAPP_FOLLOWUP_ENABLED" || log.action === "WHATSAPP_FOLLOWUP_DISABLED") && !followUpByPhone.has(key)) {
      followUpByPhone.set(key, log.action === "WHATSAPP_FOLLOWUP_ENABLED");
    }
    if (log.action === "WHATSAPP_CONVERSATION_HIDDEN") hiddenPhones.add(key);
  }
  const allowedKeys = new Set<string>();

  for (const message of scopedOutbound) {
    const order = message.orderId ? orderById.get(message.orderId) : null;
    if (
      input.allowedEventIds &&
      !order &&
      (!message.eventId || !input.allowedEventIds.includes(message.eventId))
    ) {
      continue;
    }
    const key = conversationPhoneKey(message.recipientPhone || order?.customer.phone);
    if (key) allowedKeys.add(key);
  }

  const groups = new Map<
    string,
    {
      phone: string;
      messages: typeof scopedOutbound;
    }
  >();

  for (const message of scopedOutbound) {
    const order = message.orderId ? orderById.get(message.orderId) : null;
    const phone = message.recipientPhone || order?.customer.phone || "";
    const key = conversationPhoneKey(phone);
    if (!key || hiddenPhones.has(key) || (input.allowedEventIds && !allowedKeys.has(key))) continue;
    const group = groups.get(key) || { phone, messages: [] };
    group.messages.push(message);
    groups.set(key, group);
  }

  const search = String(input.search || "").trim().toLocaleLowerCase("pt-BR");
  return Array.from(groups.entries())
    .map(([key, group]) => {
      const messages = group.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const latest = messages.at(-1)!;
      const latestOrderMessage = [...messages].reverse().find((message) => message.orderId && orderById.has(message.orderId));
      const order = (latestOrderMessage?.orderId ? orderById.get(latestOrderMessage.orderId) : null) || orderByPhone.get(key);
      const latestInbound = [...messages].reverse().find((message) => message.status === "RECEIVED");
      const latestOutbound = [...messages].reverse().find((message) => message.status !== "RECEIVED");
      const latestHumanOutbound = [...messages]
        .reverse()
        .find(
          (message) =>
            message.type === "BULK" &&
            message.status !== "FAILED" &&
            payloadSource(message.payload) !== "TCR_WHATSAPP_AI"
        );
      const name = order?.customer.name || [...messages].reverse().find((message) => message.recipientName)?.recipientName || "Contato";
      const eventTitle = order?.event.title || "Conversa pelo WhatsApp";
      const auditedReadAt = latestReadAtByPhone.get(key);
      const latestReadAt = [auditedReadAt, latestHumanOutbound?.createdAt]
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0];
      const wasAlreadyAttended = hasEverBeenRead.has(key) || Boolean(latestHumanOutbound);
      const hasUnread = Boolean(latestInbound && (!latestReadAt || latestInbound.createdAt > latestReadAt));
      const unreadQueue = hasUnread && !wasAlreadyAttended;
      const cartMessage = [...messages].reverse().find((message) => message.type === "CART_ABANDONMENT" && message.status !== "FAILED");
      const hasPaidOrder = phoneOrders.some((candidate) => conversationPhoneKey(candidate.customer.phone) === key && candidate.status === OrderStatus.PAID);
      const abandonedWithoutReturn = Boolean(
        cartMessage && !hasPaidOrder && (!latestInbound || latestInbound.createdAt <= cartMessage.createdAt)
      );
      const item = {
        key,
        name,
        phone: group.phone,
        eventTitle,
        orderCode: order?.code || null,
        latestMessage: messageContent(latest),
        latestAt: latest.createdAt,
        latestInboundId: latestInbound?.id || null,
        latestInboundAt: latestInbound?.createdAt || null,
        latestInboundMessage: latestInbound ? messageContent(latestInbound) : null,
        needsReply: hasUnread,
        hasUnread,
        unreadQueue,
        followUp: followUpByPhone.get(key) || false,
        isClosed: hasPaidOrder,
        abandonedWithoutReturn,
        canReply: Boolean(latestInbound && Date.now() - latestInbound.createdAt.getTime() < 24 * 60 * 60 * 1000),
        lastDirection: latest.status === "RECEIVED" ? ("inbound" as const) : ("outbound" as const),
        lastOutboundAt: latestOutbound?.createdAt || null,
        aiMode: aiModeByPhone.get(key) || "ACTIVE"
      };
      return item;
    })
    .filter((item) => {
      if (!search) return true;
      return [item.name, item.phone, item.eventTitle, item.orderCode, item.latestMessage]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
    })
    .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

export function clearCrmWhatsAppInboxCache(organizationId?: string) {
  if (!organizationId) {
    inboxCache.clear();
    return;
  }
  for (const key of inboxCache.keys()) {
    if (key.startsWith(`${organizationId}|`)) inboxCache.delete(key);
  }
}

export function getCrmWhatsAppInbox(input: {
  organizationId: string;
  allowedEventIds?: EventScope;
  search?: string;
  startAt?: Date;
  endAt?: Date;
}) {
  const now = Date.now();
  const key = [
    input.organizationId,
    [...(input.allowedEventIds || [])].sort().join(","),
    String(input.search || "").trim().toLocaleLowerCase("pt-BR"),
    input.startAt?.toISOString() || "",
    input.endAt?.toISOString() || ""
  ].join("|");
  const cached = inboxCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = loadCrmWhatsAppInbox(input);
  inboxCache.set(key, { expiresAt: now + INBOX_CACHE_MS, promise });
  promise.catch(() => inboxCache.delete(key));
  return promise;
}

function errorDetailsFromPayload(payload: Prisma.JsonValue | null | undefined) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const error = (payload as { error?: unknown }).error;

  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return null;
  }

  const data = error as {
    code?: unknown;
    error_subcode?: unknown;
    fbtrace_id?: unknown;
    type?: unknown;
  };
  const details = [
    typeof data.type === "string" ? data.type : null,
    typeof data.code === "number" || typeof data.code === "string" ? `code ${data.code}` : null,
    typeof data.error_subcode === "number" || typeof data.error_subcode === "string" ? `subcode ${data.error_subcode}` : null,
    typeof data.fbtrace_id === "string" ? `trace ${data.fbtrace_id}` : null
  ].filter(Boolean);

  return details.length > 0 ? details.join(" | ") : null;
}

function canReplyFrom(messages: Array<{ status: string; createdAt: Date }>) {
  const lastInbound = [...messages].reverse().find((message) => message.status === "RECEIVED");

  if (!lastInbound) {
    return false;
  }

  return Date.now() - lastInbound.createdAt.getTime() < 24 * 60 * 60 * 1000;
}

function shouldShowMessage(message: {
  status: string;
  errorMessage: string | null;
  templateName: string | null;
}) {
  if (message.status !== "FAILED") {
    return true;
  }

  return Boolean(message.templateName || message.errorMessage);
}

function isRepeatedTechnicalFailure(message: {
  status: string;
  errorMessage: string | null;
}) {
  const errorMessage = message.errorMessage || "";

  return (
    message.status === "FAILED" &&
    (/API access blocked/i.test(errorMessage) ||
      /WhatsApp Business API nao configurada/i.test(errorMessage) ||
      /Template name does not exist in the translation/i.test(errorMessage))
  );
}

async function findOrderContact(input: {
  orderCode: string;
  organizationId: string;
  allowedEventIds?: EventScope;
}) {
  return prisma.order.findFirst({
    where: {
      code: input.orderCode,
      event: {
        organizationId: input.organizationId,
        ...(input.allowedEventIds ? { id: { in: input.allowedEventIds } } : {})
      }
    },
    select: {
      id: true,
      code: true,
      eventId: true,
      expiresAt: true,
      customer: {
        select: {
          name: true,
          phone: true,
          email: true
        }
      },
      items: {
        include: {
          lot: {
            select: {
              name: true
            }
          },
          lotOption: {
            select: {
              label: true
            }
          }
        }
      },
      event: {
        select: {
          title: true
        }
      }
    }
  });
}

function formatOrderItemSummary(order: NonNullable<Awaited<ReturnType<typeof findOrderContact>>>) {
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const firstItem = order.items[0];
  const lotName = firstItem?.lotOption?.label || firstItem?.lot.name;

  if (!totalQuantity) {
    return "ingressos selecionados";
  }

  const ticketLabel = totalQuantity === 1 ? "01 ingresso" : `${String(totalQuantity).padStart(2, "0")} ingressos`;

  return lotName ? `${ticketLabel} no setor ${lotName}` : ticketLabel;
}

async function findLeadContact(input: {
  leadId: string;
  organizationId: string;
  allowedEventIds?: EventScope;
}) {
  return prisma.eventLead.findFirst({
    where: {
      id: input.leadId,
      event: {
        organizationId: input.organizationId,
        ...(input.allowedEventIds ? { id: { in: input.allowedEventIds } } : {})
      }
    },
    select: {
      id: true,
      eventId: true,
      name: true,
      phone: true,
      email: true,
      event: {
        select: {
          title: true
        }
      }
    }
  });
}

export async function getCrmWhatsAppConversation(input: {
  orderCode?: string;
  leadId?: string;
  phone?: string;
  organizationId: string;
  allowedEventIds?: EventScope;
}) {
  const order = input.orderCode
    ? await findOrderContact({
        orderCode: input.orderCode,
        organizationId: input.organizationId,
        allowedEventIds: input.allowedEventIds
      })
    : null;
  const lead =
    !order && input.leadId
      ? await findLeadContact({
          leadId: input.leadId,
          organizationId: input.organizationId,
          allowedEventIds: input.allowedEventIds
        })
      : null;
  const phone = order?.customer.phone || lead?.phone || input.phone || null;
  const phones = candidatePhones(phone);

  if (phones.length === 0) {
    return {
      contact: null,
      messages: [],
      hiddenFailureCount: 0,
      canReply: false
    };
  }

  const messageFilters: Prisma.WhatsAppMessageLogWhereInput[] = [
    {
      recipientPhone: {
        in: phones
      }
    }
  ];

  if (order) {
    messageFilters.push({
      orderId: order.id
    });
  }

  if (lead) {
    messageFilters.push({
      leadId: lead.id
    });
  }

  const rawMessages = await prisma.whatsAppMessageLog.findMany({
    where: {
      organizationId: input.organizationId,
      OR: messageFilters
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 80
  });
  const newestVisibleTechnicalFailureId = rawMessages
    .filter(isRepeatedTechnicalFailure)
    .at(-1)?.id;
  const messages = rawMessages.filter((message) => {
    if (!shouldShowMessage(message)) {
      return false;
    }

    if (!isRepeatedTechnicalFailure(message)) {
      return true;
    }

    return message.id === newestVisibleTechnicalFailureId;
  });
  const hiddenFailureCount = rawMessages.length - messages.length;

  return {
    contact: {
      name: order?.customer.name || lead?.name || "Contato",
      phone,
      email: order?.customer.email || lead?.email || null,
      eventId: order?.eventId || lead?.eventId || null,
      eventTitle: order?.event.title || lead?.event.title || null,
      orderId: order?.id || null,
      orderCode: order?.code || null,
      orderExpiresAt: order?.expiresAt || null,
      cartSummary: order ? formatOrderItemSummary(order) : null,
      leadId: lead?.id || null
    },
    messages: messages.map((message) => ({
      id: message.id,
      direction: message.status === "RECEIVED" ? "inbound" : "outbound",
      status: message.status,
      templateName: message.templateName,
      content: messageContent(message),
      media: mediaFromPayload(message.payload) || mediaFromPayload(message.webhookPayload),
      createdAt: message.createdAt,
      errorMessage: message.errorMessage,
      errorDetails: errorDetailsFromPayload(message.webhookPayload)
    })),
    hiddenFailureCount,
    canReply: canReplyFrom(messages)
  };
}
