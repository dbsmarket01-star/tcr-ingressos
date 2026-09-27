import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EventScope = string[] | null | undefined;

function normalizeDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function candidatePhones(value?: string | null) {
  const digits = normalizeDigits(value);

  if (!digits) {
    return [];
  }

  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  return Array.from(new Set([digits, `55${withoutCountry}`, withoutCountry].filter(Boolean)));
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
