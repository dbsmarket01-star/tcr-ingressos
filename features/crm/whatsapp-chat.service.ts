import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EventScope = string[] | null | undefined;

const KNOWN_WHATSAPP_TYPES = ["PURCHASE_APPROVED", "CART_ABANDONMENT", "BULK", "WEBHOOK"] as const;

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

function messageContent(message: {
  status: string;
  templateName: string | null;
  payload: Prisma.JsonValue | null;
  webhookPayload: Prisma.JsonValue | null;
}) {
  return (
    textFromPayload(message.payload) ||
    textFromPayload(message.webhookPayload) ||
    templatePreview(message.payload, message.templateName)
  );
}

type InboxResult = Awaited<ReturnType<typeof loadCrmWhatsAppInbox>>;
const inboxCache = new Map<string, { expiresAt: number; promise: Promise<InboxResult> }>();
const INBOX_CACHE_MS = 5_000;

async function loadCrmWhatsAppInbox(input: {
  organizationId: string;
  allowedEventIds?: EventScope;
  search?: string;
}) {
  const scopedOutbound = await prisma.whatsAppMessageLog.findMany({
    where: {
      organizationId: input.organizationId,
      type: {
        in: [...KNOWN_WHATSAPP_TYPES]
      }
    },
    orderBy: { createdAt: "desc" },
    take: 800,
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
    select: { action: true, entityId: true }
  });
  const aiModeByPhone = new Map<string, "ACTIVE" | "PAUSED" | "HANDOFF">();
  for (const log of aiStateLogs) {
    if (!log.entityId) continue;
    const key = log.entityId.slice(`${input.organizationId}:`.length);
    if (!key || aiModeByPhone.has(key)) continue;
    aiModeByPhone.set(
      key,
      log.action === "WHATSAPP_AI_HANDOFF" ? "HANDOFF" : log.action === "WHATSAPP_AI_PAUSED" ? "PAUSED" : "ACTIVE"
    );
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
    if (!key || (input.allowedEventIds && !allowedKeys.has(key))) continue;
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
      const needsReply = Boolean(
        latestInbound &&
          (!latestHumanOutbound || latestInbound.createdAt.getTime() > latestHumanOutbound.createdAt.getTime())
      );
      const item = {
        key,
        name,
        phone: group.phone,
        eventTitle,
        orderCode: order?.code || null,
        latestMessage: messageContent(latest),
        latestAt: latest.createdAt,
        needsReply,
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
    .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
    .slice(0, 120);
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
}) {
  const now = Date.now();
  const key = [
    input.organizationId,
    [...(input.allowedEventIds || [])].sort().join(","),
    String(input.search || "").trim().toLocaleLowerCase("pt-BR")
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
      createdAt: message.createdAt,
      errorMessage: message.errorMessage,
      errorDetails: errorDetailsFromPayload(message.webhookPayload)
    })),
    hiddenFailureCount,
    canReply: canReplyFrom(messages)
  };
}
