import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTextMessage } from "@/features/whatsapp/whatsapp.service";

const AI_SOURCE = "TCR_WHATSAPP_AI";
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_MONTHLY_LIMIT = 2_000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CUSTOMER_ORDERS = 5;

type AiOutcome = "AUTO_REPLY" | "HANDOFF" | "SILENT";

type AiDecision = {
  outcome: AiOutcome;
  reply: string;
  reason: string;
  topic: string;
};

type MetaTextMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: MetaTextMessage[] };
    }>;
  }>;
};

function isEnabled() {
  return /^(1|true|yes|on)$/i.test(
    process.env.WHATSAPP_AI_ENABLED?.trim() || process.env.WHATSAPP_AI_AUTO_REPLY_ENABLED?.trim() || ""
  );
}

function normalizeDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function phoneCandidates(value?: string | null) {
  const digits = normalizeDigits(value);
  if (!digits) return [];
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return Array.from(new Set([digits, `+${digits}`, local, `55${local}`, `+55${local}`].filter(Boolean)));
}

function phoneKey(value?: string | null) {
  const digits = normalizeDigits(value);
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

function brl(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);
}

function brDate(value?: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(value);
}

function firstName(value?: string | null) {
  return String(value || "cliente").trim().split(/\s+/)[0] || "cliente";
}

function knowledgeText(value?: string | null) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 2_000) : null;
}

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function contentFromLog(message: {
  payload: Prisma.JsonValue | null;
  webhookPayload: Prisma.JsonValue | null;
  templateName: string | null;
}) {
  const payload = jsonObject(message.payload);
  const webhook = jsonObject(message.webhookPayload);
  const payloadText = payload.text;
  const webhookText = webhook.text;
  if (typeof payloadText === "string") return payloadText;
  if (payloadText && typeof payloadText === "object" && !Array.isArray(payloadText)) {
    const body = (payloadText as Record<string, unknown>).body;
    if (typeof body === "string") return body;
  }
  if (webhookText && typeof webhookText === "object" && !Array.isArray(webhookText)) {
    const body = (webhookText as Record<string, unknown>).body;
    if (typeof body === "string") return body;
  }
  return message.templateName ? `[mensagem automatica: ${message.templateName}]` : "[mensagem sem texto]";
}

function aiMetadataFromLog(payload: Prisma.JsonValue | null | undefined) {
  const data = jsonObject(payload);
  return data._ai && typeof data._ai === "object" && !Array.isArray(data._ai)
    ? (data._ai as Record<string, unknown>)
    : null;
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

export function parseWhatsAppAiDecision(payload: unknown): AiDecision {
  const text = extractResponseText(payload);
  if (!text) throw new Error("A OpenAI nao devolveu uma decisao em texto.");
  const parsed = JSON.parse(text) as Partial<AiDecision>;
  if (!parsed.outcome || !["AUTO_REPLY", "HANDOFF", "SILENT"].includes(parsed.outcome)) {
    throw new Error("A OpenAI devolveu uma decisao invalida.");
  }
  return {
    outcome: parsed.outcome,
    reply: String(parsed.reply || "").trim(),
    reason: String(parsed.reason || "").trim(),
    topic: String(parsed.topic || "outro").trim()
  };
}

function conversationStateAction(action?: string | null) {
  if (action === "WHATSAPP_AI_ENABLED") return "ACTIVE" as const;
  if (action === "WHATSAPP_AI_PAUSED") return "PAUSED" as const;
  if (action === "WHATSAPP_AI_HANDOFF") return "HANDOFF" as const;
  return null;
}

export async function getWhatsAppAiConversationState(organizationId: string, phone?: string | null) {
  const key = phoneKey(phone);
  if (!key || !isEnabled()) return { mode: "DISABLED" as const, reason: "IA desativada no ambiente." };
  const latest = await prisma.adminAuditLog.findFirst({
    where: {
      entityType: "WHATSAPP_CONVERSATION",
      entityId: `${organizationId}:${key}`,
      action: { in: ["WHATSAPP_AI_ENABLED", "WHATSAPP_AI_PAUSED", "WHATSAPP_AI_HANDOFF"] }
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, metadata: true, createdAt: true }
  });
  const explicit = conversationStateAction(latest?.action);
  return {
    mode: explicit || ("ACTIVE" as const),
    reason: String(jsonObject(latest?.metadata).reason || "Atendimento automatico ativo."),
    changedAt: latest?.createdAt || null
  };
}

export async function setWhatsAppAiConversationState(input: {
  organizationId: string;
  phone: string;
  mode: "ACTIVE" | "PAUSED" | "HANDOFF";
  reason?: string;
  adminUserId?: string | null;
}) {
  const key = phoneKey(input.phone);
  if (!key) throw new Error("Telefone invalido para controlar a IA.");
  const action =
    input.mode === "ACTIVE"
      ? "WHATSAPP_AI_ENABLED"
      : input.mode === "HANDOFF"
        ? "WHATSAPP_AI_HANDOFF"
        : "WHATSAPP_AI_PAUSED";
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId || null,
      action,
      entityType: "WHATSAPP_CONVERSATION",
      entityId: `${input.organizationId}:${key}`,
      metadata: {
        phone: key,
        reason: input.reason || (input.mode === "ACTIVE" ? "IA reativada." : "Atendimento humano assumiu a conversa.")
      }
    }
  });
}

async function monthlyUsageAllowed(organizationId: string) {
  const configured = Number(process.env.WHATSAPP_AI_MONTHLY_MESSAGE_LIMIT || DEFAULT_MONTHLY_LIMIT);
  const limit = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MONTHLY_LIMIT;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const used = await prisma.whatsAppMessageLog.count({
    where: {
      organizationId,
      createdAt: { gte: start },
      payload: { path: ["source"], equals: AI_SOURCE }
    }
  });
  return { allowed: used < limit, used, limit };
}

async function loadSupportContext(organizationId: string, phone: string) {
  const candidates = phoneCandidates(phone);
  const orders = await prisma.order.findMany({
    where: {
      customer: { phone: { in: candidates } },
      event: { organizationId }
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CUSTOMER_ORDERS,
    select: {
      code: true,
      status: true,
      subtotalInCents: true,
      serviceFeeInCents: true,
      cardInterestInCents: true,
      totalInCents: true,
      createdAt: true,
      paidAt: true,
      expiresAt: true,
      ticketsEmailStatus: true,
      ticketsEmailSentAt: true,
      customer: { select: { name: true } },
      payment: { select: { status: true, provider: true, paidAt: true, pixExpiresAt: true } },
      event: {
        select: {
          title: true,
          startsAt: true,
          doorsOpenAt: true,
          venueName: true,
          venueAddress: true,
          city: true,
          state: true,
          importantInfo: true
        }
      },
      items: {
        select: {
          quantity: true,
          admissionsPerUnit: true,
          lot: { select: { name: true } },
          lotOption: { select: { label: true } }
        }
      },
      tickets: { select: { status: true } }
    }
  });

  const logs = await prisma.whatsAppMessageLog.findMany({
    where: { organizationId, recipientPhone: { in: candidates } },
    orderBy: { createdAt: "desc" },
    take: MAX_CONTEXT_MESSAGES,
    select: { status: true, payload: true, webhookPayload: true, templateName: true, createdAt: true }
  });

  const settings = await prisma.companySettings.findUnique({
    where: { organizationId },
    select: {
      companyName: true,
      tradeName: true,
      supportEmail: true,
      supportPhone: true,
      footerFaqContent: true,
      footerHelpContent: true,
      footerCancellationPolicyContent: true,
      footerContactContent: true
    }
  });

  const activeEvents = await prisma.event.findMany({
    where: {
      organizationId,
      status: "PUBLISHED",
      startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    orderBy: { startsAt: "asc" },
    take: 12,
    select: {
      slug: true,
      title: true,
      startsAt: true,
      doorsOpenAt: true,
      venueName: true,
      venueAddress: true,
      city: true,
      state: true,
      importantInfo: true,
      lots: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          name: true,
          priceInCents: true,
          serviceFeeBps: true,
          cardInterestBpsPerInstallment: true,
          cardInterestStartsAtInstallment: true,
          admissionsPerUnit: true,
          status: true,
          typeOptions: {
            where: { status: "ACTIVE" },
            orderBy: { sortOrder: "asc" },
            select: { label: true }
          }
        }
      }
    }
  });

  const publicBaseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.tcringressos.app.br").replace(/\/$/, "");
  const customerName = orders[0]?.customer.name || "cliente";
  return {
    customer: { firstName: firstName(customerName) },
    businessRules: {
      doubleTicket:
        "Cadeira duplo, ingresso duplo ou qualquer produto identificado como duplo vale para duas pessoas e gera dois ingressos com dois QR Codes individuais.",
      paymentMethods: "A TCR Ingressos aceita Pix e cartao de credito.",
      cardInstallments:
        "O cartao de credito pode ser parcelado em ate 6 vezes. O parcelamento possui juros; informe o valor exibido no checkout e nunca invente o total das parcelas.",
      fees:
        "A taxa de bilheteria e os juros devem ser informados conforme os dados do ingresso e do checkout. Nao estime nem recalcule valores ausentes."
    },
    company: settings
      ? {
          ...settings,
          footerFaqContent: knowledgeText(settings.footerFaqContent),
          footerHelpContent: knowledgeText(settings.footerHelpContent),
          footerCancellationPolicyContent: knowledgeText(settings.footerCancellationPolicyContent),
          footerContactContent: knowledgeText(settings.footerContactContent)
        }
      : null,
    activeEvents: activeEvents.map((event) => ({
      title: event.title,
      startsAt: brDate(event.startsAt),
      doorsOpenAt: brDate(event.doorsOpenAt),
      venue: event.venueName,
      address: event.venueAddress,
      city: event.city,
      state: event.state,
      importantInfo: knowledgeText(event.importantInfo),
      url: `${publicBaseUrl}/evento/${event.slug}`,
      tickets: event.lots.map((lot) => ({
        name: lot.name,
        options: lot.typeOptions.map((option) => option.label),
        basePrice: brl(lot.priceInCents),
        serviceFeePercent: lot.serviceFeeBps / 100,
        cardInterestPercentPerInstallment: lot.cardInterestBpsPerInstallment / 100,
        cardInterestStartsAtInstallment: lot.cardInterestStartsAtInstallment,
        admissionsPerUnit: lot.admissionsPerUnit
      }))
    })),
    orders: orders.map((order) => ({
      code: order.code,
      status: order.status,
      paymentStatus: order.payment?.status || null,
      paymentProvider: order.payment?.provider || null,
      createdAt: brDate(order.createdAt),
      paidAt: brDate(order.paidAt || order.payment?.paidAt),
      expiresAt: brDate(order.expiresAt),
      pixExpiresAt: brDate(order.payment?.pixExpiresAt),
      subtotal: brl(order.subtotalInCents),
      serviceFee: brl(order.serviceFeeInCents),
      cardInterest: brl(order.cardInterestInCents),
      total: brl(order.totalInCents),
      ticketEmailStatus: order.ticketsEmailStatus,
      ticketEmailSentAt: brDate(order.ticketsEmailSentAt),
      issuedTickets: order.tickets.length,
      activeTickets: order.tickets.filter((ticket) => ticket.status === "ACTIVE").length,
      usedTickets: order.tickets.filter((ticket) => ticket.status === "USED").length,
      items: order.items.map((item) => ({
        name: item.lotOption?.label ? `${item.lot.name} - ${item.lotOption.label}` : item.lot.name,
        purchasedUnits: item.quantity,
        admissionsPerUnit: item.admissionsPerUnit,
        totalAdmissions: item.quantity * item.admissionsPerUnit
      })),
      event: {
        title: order.event.title,
        startsAt: brDate(order.event.startsAt),
        doorsOpenAt: brDate(order.event.doorsOpenAt),
        venue: order.event.venueName,
        address: order.event.venueAddress,
        city: order.event.city,
        state: order.event.state,
        importantInfo: order.event.importantInfo
      },
      orderUrl: `${publicBaseUrl}/pedido/${order.code}`
    })),
    conversation: logs.reverse().map((message) => ({
      direction: message.status === "RECEIVED" ? "customer" : "support",
      text: contentFromLog(message),
      at: brDate(message.createdAt)
    }))
  };
}

function developerInstructions() {
  return `Voce e a assistente virtual oficial da TCR Ingressos no WhatsApp.

OBJETIVO
Atenda em portugues brasileiro com acolhimento, clareza e mensagens curtas. Resolva apenas o que os dados fornecidos comprovam. Nao diga que e humana. Na primeira resposta, apresente-se discretamente como assistente virtual da TCR Ingressos.

REGRAS CRITICAS
1. Os dados do CONTEXTO DO SISTEMA sao a unica fonte de verdade para pedidos, pagamentos, ingressos e eventos.
2. Nunca afirme que um pagamento foi aprovado se order.status nao for PAID ou paymentStatus nao for APPROVED.
3. Se o cliente disser que pagou e o sistema nao confirmar, use HANDOFF. Nao mande pagar novamente.
4. Estorno, cancelamento, chargeback, ameaca juridica, alteracao de titularidade, divergencia financeira, reclamacao grave ou pedido que exige mudanca manual sempre usam HANDOFF.
5. Nunca solicite senha, numero completo do cartao, CVV, codigo de verificacao ou foto de documento pelo WhatsApp.
6. Nao revele CPF, e-mail completo, dados de outros clientes, identificadores internos nem detalhes tecnicos.
7. Ingresso duplo vale duas admissoes. Use totalAdmissions e issuedTickets para explicar quantos QR Codes existem; se houver divergencia, HANDOFF.
7.1. Como regra comercial geral, cadeira duplo ou ingresso duplo e para duas pessoas e gera dois ingressos com dois QR Codes individuais.
7.2. A TCR aceita Pix e cartao de credito. O cartao pode ser parcelado em ate 6 vezes, com juros. Para valores, taxas e parcelas, use apenas os dados exibidos no contexto ou oriente o cliente a conferir o resumo do checkout; nunca invente calculos.
8. Para pedido pendente, pode fornecer somente o orderUrl existente no contexto.
9. Se nao houver informacao suficiente ou houver qualquer duvida sobre os dados, use HANDOFF.
10. Nao prometa prazo ou acao futura que nao esteja garantida.
11. Nao repita saudacoes em todas as mensagens. Responda ao ponto, em no maximo 550 caracteres, com no maximo uma pergunta.
12. SILENT so deve ser usado para mensagem vazia, figurinha sem contexto, confirmacao final que nao exige resposta ou conteudo automatico.

SAIDA
AUTO_REPLY quando puder responder com seguranca.
HANDOFF quando uma pessoa precisar assumir; nesse caso escreva uma mensagem curta dizendo que encaminhou para a equipe, sem inventar prazo.
SILENT quando nenhuma resposta for necessaria.`;
}

async function requestDecision(userText: string, context: Awaited<ReturnType<typeof loadSupportContext>>) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY nao configurada.");
  const timeoutMs = Number(process.env.OPENAI_CHAT_TIMEOUT_MS || 12_000);
  const maxOutputTokens = Number(process.env.OPENAI_CHAT_MAX_OUTPUT_TOKENS || 360);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 12_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.WHATSAPP_AI_MODEL?.trim() || process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 360,
      input: [
        { role: "developer", content: developerInstructions() },
        {
          role: "user",
          content: `MENSAGEM NOVA DO CLIENTE:\n${userText}\n\nCONTEXTO DO SISTEMA:\n${JSON.stringify(context)}`
        }
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "whatsapp_support_decision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              outcome: { type: "string", enum: ["AUTO_REPLY", "HANDOFF", "SILENT"] },
              reply: { type: "string" },
              reason: { type: "string" },
              topic: { type: "string" }
            },
            required: ["outcome", "reply", "reason", "topic"]
          }
        }
      }
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI retornou HTTP ${response.status}: ${detail.slice(0, 240)}`);
  }
  return parseWhatsAppAiDecision(await response.json());
}

async function markInboundAi(input: {
  id: string;
  webhookPayload: Prisma.JsonValue | null;
  status: string;
  outcome?: string;
  topic?: string;
  reason?: string;
  error?: string;
}) {
  const payload = jsonObject(input.webhookPayload);
  await prisma.whatsAppMessageLog.update({
    where: { id: input.id },
    data: {
      webhookPayload: {
        ...payload,
        _ai: {
          status: input.status,
          outcome: input.outcome || null,
          topic: input.topic || null,
          reason: input.reason || null,
          error: input.error || null,
          processedAt: new Date().toISOString()
        }
      } as Prisma.InputJsonValue
    }
  });
}

async function processInboundMessage(message: MetaTextMessage) {
  if (!isEnabled() || message.type !== "text" || !message.id || !message.from || !message.text?.body?.trim()) return;
  const inbound = await prisma.whatsAppMessageLog.findFirst({
    where: { providerMessageId: message.id, status: "RECEIVED" },
    select: { id: true, organizationId: true, webhookPayload: true }
  });
  if (!inbound?.organizationId || aiMetadataFromLog(inbound.webhookPayload)) return;

  const state = await getWhatsAppAiConversationState(inbound.organizationId, message.from);
  if (state.mode !== "ACTIVE") {
    await markInboundAi({ id: inbound.id, webhookPayload: inbound.webhookPayload, status: "SKIPPED", reason: state.reason });
    return;
  }
  const usage = await monthlyUsageAllowed(inbound.organizationId);
  if (!usage.allowed) {
    await setWhatsAppAiConversationState({
      organizationId: inbound.organizationId,
      phone: message.from,
      mode: "HANDOFF",
      reason: `Limite mensal da IA atingido (${usage.used}/${usage.limit}).`
    });
    await markInboundAi({ id: inbound.id, webhookPayload: inbound.webhookPayload, status: "SKIPPED", reason: "Limite mensal atingido." });
    return;
  }

  await markInboundAi({ id: inbound.id, webhookPayload: inbound.webhookPayload, status: "PROCESSING" });
  try {
    const context = await loadSupportContext(inbound.organizationId, message.from);
    const decision = await requestDecision(message.text.body.trim(), context);
    if (decision.outcome === "HANDOFF") {
      await setWhatsAppAiConversationState({
        organizationId: inbound.organizationId,
        phone: message.from,
        mode: "HANDOFF",
        reason: decision.reason
      });
    }
    if (decision.outcome !== "SILENT" && decision.reply) {
      await sendWhatsAppTextMessage({
        to: message.from,
        text: decision.reply,
        organizationId: inbound.organizationId,
        recipientName: context.customer.firstName,
        source: AI_SOURCE,
        metadata: { outcome: decision.outcome, topic: decision.topic, inboundProviderMessageId: message.id }
      });
    }
    await markInboundAi({
      id: inbound.id,
      webhookPayload: inbound.webhookPayload,
      status: "COMPLETED",
      outcome: decision.outcome,
      topic: decision.topic,
      reason: decision.reason
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp AI] Falha ao atender mensagem", { providerMessageId: message.id, error: detail });
    await markInboundAi({ id: inbound.id, webhookPayload: inbound.webhookPayload, status: "FAILED", error: detail.slice(0, 500) });
  }
}

export async function processWhatsAppSupportAiPayload(payload: unknown) {
  const body = payload as MetaWebhookPayload;
  const messages = body.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages || []) || []) || [];
  for (const message of messages) await processInboundMessage(message);
}

export const WHATSAPP_AI_SOURCE = AI_SOURCE;
