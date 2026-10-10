import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTextMessage } from "@/features/whatsapp/whatsapp.service";
import { calculateServiceFeeInCents } from "@/features/pricing/pricing";
import {
  calculateCardChargeInCents,
  calculateNetTicketAmountInCents,
  type PaymentFeeSettings
} from "@/features/payments/payment-fee-calculator";
import { calculateAsaasSplitsForOrder, sumAsaasSplitsInCents } from "@/features/payments/asaas-split.service";
import { getEffectivePaymentFeeSettings, getEffectiveServiceFeeBps } from "@/features/pricing/organization-pricing-policy";
import { getCreditCardInstallmentLimitForEvent } from "@/lib/payment-installments";
import { loadApprovedSupportKnowledge } from "@/features/ai/whatsapp-support-knowledge.service";

const AI_SOURCE = "TCR_WHATSAPP_AI";
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_MONTHLY_LIMIT = 2_000;
const DEFAULT_HUMAN_PAUSE_HOURS = 12;
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

function normalizeIntent(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PublishedTicketEvent = {
  title: string;
  tickets: Array<{ name: string; options?: string[]; availableUnits: number }>;
};

function ticketSector(name: string) {
  return normalizeIntent(name)
    .replace(/\b(meia entrada|meia|inteira|inteiro|solidario|exclusivo|promocional)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHalfPriceTicket(ticket: PublishedTicketEvent["tickets"][number]) {
  return /\bmeia(?: entrada)?\b/.test(normalizeIntent(ticket.name)) ||
    (ticket.options || []).some((option) => /\bmeia(?: entrada)?\b/.test(normalizeIntent(option)));
}

export function guardPublishedHalfPriceAnswer(input: {
  customerMessage: string;
  decision: AiDecision;
  events: PublishedTicketEvent[];
}): AiDecision {
  const question = normalizeIntent(input.customerMessage);
  const answer = normalizeIntent(input.decision.reply);
  if (input.decision.outcome !== "AUTO_REPLY" || !/\bmeia\b/.test(question) ||
      !/\bmeia\b/.test(answer) || !/\b(sim|tem|existe|disponivel|paga|pode comprar|direito)\b/.test(answer)) {
    return input.decision;
  }

  const matches = input.events.flatMap((event) => {
    const sectors = Array.from(new Set(event.tickets.map((ticket) => ticketSector(ticket.name))));
    return sectors.filter((sector) => sector.length >= 5 && question.includes(sector)).map((sector) => ({
      event,
      sector,
      hasHalfPrice: event.tickets.some((ticket) =>
        ticket.availableUnits > 0 && ticketSector(ticket.name) === sector && isHalfPriceTicket(ticket)
      )
    }));
  });
  if (!matches.length || matches.every((match) => match.hasHalfPrice)) return input.decision;

  const sector = matches[0].sector;
  if (matches.some((match) => match.hasHalfPrice)) {
    return {
      outcome: "AUTO_REPLY",
      reply: `A disponibilidade de meia-entrada para ${sector} varia conforme o evento. Qual é o evento ou a cidade? Assim confirmo as opções publicadas antes de te orientar.`,
      reason: "A modalidade de meia-entrada varia entre os eventos encontrados para o setor.",
      topic: "ingresso_meia_entrada"
    };
  }
  return {
    outcome: "AUTO_REPLY",
    reply: `Não encontrei ingresso de meia-entrada disponível para ${sector} nas opções publicadas desse setor. Posso te ajudar a conferir os ingressos disponíveis para o evento.`,
    reason: "Não há modalidade de meia-entrada disponível nos ingressos publicados do setor citado.",
    topic: "ingresso_meia_entrada"
  };
}

export function isHumanHandoffRequest(value?: string | null) {
  const text = normalizeIntent(value);
  if (!text) return false;
  return [
    /\bfalar com (um |uma )?atendente\b/,
    /\bfalar com (uma )?pessoa\b/,
    /\bquero (um |uma )?atendente\b/,
    /\bquero atendimento humano\b/,
    /\batendente humano\b/,
    /\batendimento (com uma pessoa|pessoal|humano)\b/,
    /\bpreciso (de )?(um |uma )?atendente\b/,
    /\bchama(r)? (um |uma )?atendente\b/
  ].some((pattern) => pattern.test(text));
}

export function shouldProcessWhatsAppAiMessage(mode: string) {
  return mode === "ACTIVE";
}

export function shouldProcessWhatsAppAiState(state: { mode: string; reason?: string | null }) {
  return shouldProcessWhatsAppAiMessage(state.mode) ||
    (state.mode === "HANDOFF" && state.reason === "Cliente solicitou atendimento humano.");
}

export function resolvedHandoffReply(reply: string) {
  const invitation =
    'Se sua dúvida não ficou resolvida e ainda quiser falar com uma pessoa, escreva novamente "falar com atendente".';
  return `${reply.trim()}\n\n${invitation}`.trim();
}

function brl(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);
}

type QuoteItem = {
  quantity: number;
  totalInCents: number;
  admissionsPerUnit?: number | null;
};

type QuoteSplitRule = Parameters<typeof calculateAsaasSplitsForOrder>[1][number];

export function buildExactCardInstallmentOptions(input: {
  subtotalInCents: number;
  serviceFeeInCents: number;
  discountInCents?: number;
  items: QuoteItem[];
  splitRules: QuoteSplitRule[];
  feeSettings: PaymentFeeSettings;
  maxInstallments: number;
}) {
  const discountInCents = Math.max(input.discountInCents || 0, 0);
  const netTicketInCents = calculateNetTicketAmountInCents(input.subtotalInCents, discountInCents);

  return Array.from({ length: Math.max(Math.trunc(input.maxInstallments), 1) }, (_, index) => index + 1)
    .map((installments) => {
      const splits = calculateAsaasSplitsForOrder(input.items, input.splitRules, {
        discountInCents,
        installments
      });
      const splitTotalInCents = sumAsaasSplitsInCents(splits);
      const configuredCardFeeInCents = Math.max(
        input.serviceFeeInCents - input.feeSettings.pixTransactionFeeInCents,
        splitTotalInCents
      );
      const totalInCents = calculateCardChargeInCents(
        netTicketInCents,
        configuredCardFeeInCents,
        installments,
        input.feeSettings
      );

      return {
        installments,
        totalInCents,
        installmentValueInCents: Math.ceil(totalInCents / installments)
      };
    })
    .filter((option) => option.installmentValueInCents >= 500);
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

function humanPauseHours() {
  const configured = Number(process.env.WHATSAPP_AI_HUMAN_PAUSE_HOURS || DEFAULT_HUMAN_PAUSE_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_HUMAN_PAUSE_HOURS;
}

export function humanPauseUntil(from = new Date()) {
  return new Date(from.getTime() + humanPauseHours() * 60 * 60 * 1_000);
}

export function resolveWhatsAppAiConversationMode(input: {
  action?: string | null;
  metadata?: Prisma.JsonValue | null;
  now?: Date;
}) {
  const explicit = conversationStateAction(input.action);
  if (explicit !== "PAUSED") return explicit || ("ACTIVE" as const);

  const pausedUntilValue = jsonObject(input.metadata).pausedUntil;
  const pausedUntil = typeof pausedUntilValue === "string" ? new Date(pausedUntilValue) : null;
  if (pausedUntil && Number.isFinite(pausedUntil.getTime()) && pausedUntil.getTime() <= (input.now || new Date()).getTime()) {
    return "ACTIVE" as const;
  }
  return "PAUSED" as const;
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
  const mode = resolveWhatsAppAiConversationMode({ action: latest?.action, metadata: latest?.metadata });
  const metadata = jsonObject(latest?.metadata);
  return {
    mode,
    reason:
      mode === "ACTIVE" && latest?.action === "WHATSAPP_AI_PAUSED"
        ? "Pausa do atendimento humano encerrada; IA reativada automaticamente."
        : String(metadata.reason || "Atendimento automatico ativo."),
    changedAt: latest?.createdAt || null,
    pausedUntil: typeof metadata.pausedUntil === "string" ? metadata.pausedUntil : null
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
  const pausedUntil = input.mode === "PAUSED" ? humanPauseUntil() : null;
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId || null,
      action,
      entityType: "WHATSAPP_CONVERSATION",
      entityId: `${input.organizationId}:${key}`,
      metadata: {
        phone: key,
        reason: input.reason || (input.mode === "ACTIVE" ? "IA reativada." : "Atendimento humano assumiu a conversa."),
        pausedUntil: pausedUntil?.toISOString() || null
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
      discountInCents: true,
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
          slug: true,
          organization: { select: { slug: true } },
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
          totalInCents: true,
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
      footerContactContent: true,
      pixTransactionFeeInCents: true,
      cardBaseFeeBps: true,
      cardAdditionalInstallmentFeeBps: true
    }
  });

  const splitRules = await prisma.paymentSplitRule.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      walletId: true,
      type: true,
      percentageBps: true,
      fixedValueInCents: true
    }
  });

  const activeEvents = await prisma.event.findMany({
    where: {
      organizationId,
      OR: [
        { status: "PUBLISHED", startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { slug: { in: orders.map((order) => order.event.slug) } }
      ]
    },
    orderBy: { startsAt: "asc" },
    take: 12,
    select: {
      id: true,
      slug: true,
      organization: { select: { slug: true } },
      title: true,
      subtitle: true,
      description: true,
      startsAt: true,
      doorsOpenAt: true,
      salesEndsAt: true,
      venueName: true,
      venueAddress: true,
      googleMapsUrl: true,
      city: true,
      state: true,
      importantInfo: true,
      eventMapNotes: true,
      lots: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          name: true,
          description: true,
          priceInCents: true,
          serviceFeeBps: true,
          cardInterestBpsPerInstallment: true,
          cardInterestStartsAtInstallment: true,
          admissionsPerUnit: true,
          totalQuantity: true,
          soldQuantity: true,
          reservedQuantity: true,
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

  const approvedKnowledge = await loadApprovedSupportKnowledge(organizationId, activeEvents.map((event) => event.id));

  const publicBaseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.tcringressos.app.br").replace(/\/$/, "");
  const customerName = orders[0]?.customer.name || "cliente";
  const storedFeeSettings: PaymentFeeSettings = {
    pixTransactionFeeInCents: settings?.pixTransactionFeeInCents || 0,
    cardBaseFeeBps: settings?.cardBaseFeeBps || 0,
    cardAdditionalInstallmentFeeBps: settings?.cardAdditionalInstallmentFeeBps || 0
  };
  return {
    customer: { firstName: firstName(customerName) },
    hasPreviousAiReply: logs.some((message) => jsonObject(message.payload).source === AI_SOURCE),
    businessRules: {
      doubleTicket:
        "Cadeira duplo, ingresso duplo ou qualquer produto identificado como duplo vale para duas pessoas e gera dois ingressos com dois QR Codes individuais.",
      paymentMethods: "A TCR Ingressos aceita Pix e cartao de credito.",
      cardInstallments:
        "O cartao de credito pode ser parcelado. Para responder valores, use exclusivamente as simulacoes exatas do checkout presentes em exactCardInstallmentOptions.",
      fees:
        "A taxa de bilheteria e os juros devem ser informados conforme os dados do ingresso e as simulacoes exatas do checkout. Nao estime nem recalcule valores ausentes."
    },
    approvedKnowledge,
    company: settings
      ? {
          ...settings,
          footerFaqContent: knowledgeText(settings.footerFaqContent),
          footerHelpContent: knowledgeText(settings.footerHelpContent),
          footerCancellationPolicyContent: knowledgeText(settings.footerCancellationPolicyContent),
          footerContactContent: knowledgeText(settings.footerContactContent)
        }
      : null,
    activeEvents: activeEvents.map((event) => {
      const feeSettings = getEffectivePaymentFeeSettings(event.organization.slug, storedFeeSettings, event.slug);
      const maxInstallments = getCreditCardInstallmentLimitForEvent(event);
      return {
        id: event.id,
        title: event.title,
        subtitle: event.subtitle,
        description: knowledgeText(event.description),
        startsAt: brDate(event.startsAt),
        doorsOpenAt: brDate(event.doorsOpenAt),
        salesEndsAt: brDate(event.salesEndsAt),
        venue: event.venueName,
        address: event.venueAddress,
        googleMapsUrl: event.googleMapsUrl,
        city: event.city,
        state: event.state,
        importantInfo: knowledgeText(event.importantInfo),
        eventMapNotes: knowledgeText(event.eventMapNotes),
        url: `${publicBaseUrl}/evento/${event.slug}`,
        tickets: event.lots.map((lot) => {
          const effectiveServiceFeeBps = getEffectiveServiceFeeBps(
            event.organization.slug,
            lot.serviceFeeBps,
            event.slug
          );
          const serviceFeeInCents = calculateServiceFeeInCents(lot.priceInCents, 1, effectiveServiceFeeBps);
          const exactOptions = buildExactCardInstallmentOptions({
            subtotalInCents: lot.priceInCents,
            serviceFeeInCents,
            items: [{ quantity: 1, totalInCents: lot.priceInCents, admissionsPerUnit: lot.admissionsPerUnit }],
            splitRules,
            feeSettings,
            maxInstallments
          });
          return {
            name: lot.name,
            description: knowledgeText(lot.description),
            options: lot.typeOptions.map((option) => option.label),
            basePrice: brl(lot.priceInCents),
            serviceFee: brl(serviceFeeInCents),
            admissionsPerUnit: lot.admissionsPerUnit,
            availableUnits: Math.max(lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity, 0),
            exactCardInstallmentOptionsForOneUnit: exactOptions.map((option) => ({
              installments: option.installments,
              installmentValue: brl(option.installmentValueInCents),
              total: brl(option.totalInCents)
            }))
          };
        })
      };
    }),
    orders: orders.map((order) => {
      const feeSettings = getEffectivePaymentFeeSettings(order.event.organization.slug, storedFeeSettings, order.event.slug);
      const exactOptions = buildExactCardInstallmentOptions({
        subtotalInCents: order.subtotalInCents,
        serviceFeeInCents: order.serviceFeeInCents,
        discountInCents: order.discountInCents,
        items: order.items.map((item) => ({
          quantity: item.quantity,
          totalInCents: item.totalInCents,
          admissionsPerUnit: item.admissionsPerUnit
        })),
        splitRules,
        feeSettings,
        maxInstallments: getCreditCardInstallmentLimitForEvent(order.event)
      });
      return {
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
      exactCardInstallmentOptions: exactOptions.map((option) => ({
        installments: option.installments,
        installmentValue: brl(option.installmentValueInCents),
        total: brl(option.totalInCents)
      })),
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
      };
    }),
    conversation: logs.reverse().map((message) => ({
      direction: message.status === "RECEIVED" ? "customer" : "support",
      text: contentFromLog(message),
      at: brDate(message.createdAt)
    }))
  };
}

function developerInstructions(pendingHumanRequest = false) {
  return `Voce e a assistente virtual oficial da TCR Ingressos no WhatsApp.

OBJETIVO
Atenda em portugues brasileiro como uma excelente consultora comercial da TCR Ingressos: humana no tom, atenciosa, objetiva, segura e interessada em ajudar a pessoa a escolher e concluir a compra. Resolva apenas o que os dados fornecidos comprovam. Nao diga que e humana. Na primeira resposta, apresente-se discretamente como assistente virtual da TCR Ingressos.

ESTILO DE ATENDIMENTO
- Comece respondendo exatamente ao que a pessoa perguntou. Depois, quando for util, conduza para o proximo passo da compra.
- Escreva como uma pessoa cordial, nao como um robo: varie as frases, reconheca a intencao do cliente e mantenha continuidade com as mensagens anteriores.
- Apresente datas, locais, setores, precos, regras e links de forma organizada e facil de ler.
- Seja comercial sem pressionar, criar urgencia falsa, inventar escassez ou oferecer desconto inexistente.
- Nao sugira pagamento a vista nem destaque economia quando o cliente pediu parcelamento. Responda somente a simulacao solicitada.
- Ao recomendar setor, explique brevemente o criterio com base apenas nos nomes, descricoes e informacoes reais disponiveis. Nao chame um setor de melhor se o contexto nao sustentar isso.
- Quando a duvida estiver respondida e houver um link de evento ou pedido pertinente, ofereca o link naturalmente para a pessoa continuar a compra.

REGRAS CRITICAS
1. Os dados do CONTEXTO DO SISTEMA sao a unica fonte de verdade para pedidos, pagamentos, ingressos e eventos.
1.1. approvedKnowledge contem regras revisadas pela equipe. Regras com eventId so valem para o evento correspondente. Nunca aplique a outro evento. Se houver conflito com preco, disponibilidade, descricao ou outras informacoes atuais do sistema, prevalecem os dados atuais e use HANDOFF quando a divergencia afetar a resposta.
2. Nunca afirme que um pagamento foi aprovado se order.status nao for PAID ou paymentStatus nao for APPROVED.
3. Se o cliente disser que pagou e o sistema nao confirmar, use HANDOFF. Nao mande pagar novamente.
4. Estorno, cancelamento, chargeback, ameaca juridica, alteracao de titularidade, divergencia financeira, reclamacao grave ou pedido que exige mudanca manual sempre usam HANDOFF.
5. Nunca solicite senha, numero completo do cartao, CVV, codigo de verificacao ou foto de documento pelo WhatsApp.
6. Nao revele CPF, e-mail completo, dados de outros clientes, identificadores internos nem detalhes tecnicos.
7. Ingresso duplo vale duas admissoes. Use totalAdmissions e issuedTickets para explicar quantos QR Codes existem; se houver divergencia, HANDOFF.
7.1. Como regra comercial geral, cadeira duplo ou ingresso duplo e para duas pessoas e gera dois ingressos com dois QR Codes individuais.
7.2. A TCR aceita Pix e cartao de credito. Para simulacoes no cartao, use exclusivamente exactCardInstallmentOptions do pedido real quando houver um pedido correspondente. Sem pedido, use exactCardInstallmentOptionsForOneUnit do ingresso e deixe claro que o valor e para uma unidade. O total e o valor de cada parcela ja foram calculados pelo mesmo motor do checkout: copie esses valores exatamente, sem recalcular, arredondar ou estimar.
7.3. Se o cliente informar apenas o numero de parcelas em resposta a uma pergunta anterior, recupere da conversa o evento, setor e pedido a que ele se refere. Nao encaminhe ao humano apenas porque a pergunta envolve parcelamento.
7.4. Se houver mais de um ingresso ou evento possivel e isso realmente mudar a resposta, faca uma unica pergunta curta para esclarecer. Use HANDOFF somente se, mesmo com o contexto e essa confirmacao, nao existir dado confiavel.
7.5. Informacoes publicadas no site que estejam em activeEvents, company ou businessRules podem e devem ser respondidas diretamente, com boa apresentacao. Nao encaminhe duvidas comuns que o contexto resolve.
7.6. Ao explicar tipos de ingresso, leia primeiro a description do ingresso e importantInfo do evento correspondente. Explique de forma pratica: meia-entrada exige o enquadramento indicado; solidario exige exatamente a doacao informada; inteira nao exige comprovacao ou doacao; duplo vale o numero de admissoes registrado. Se a regra disser "por pessoa", deixe isso explicito.
7.7. Nunca copie a exigencia de alimento, documento, faixa etaria ou regra comercial de outro evento. Se a description e importantInfo do evento consultado nao trouxerem a resposta, faca uma pergunta de esclarecimento ou use HANDOFF, sem completar por suposicao.
7.8. Separe direito legal a meia-entrada de disponibilidade de um tipo de ingresso em um setor. A fonte para dizer que existe ou pode ser comprado ingresso de meia-entrada num setor e exclusivamente a lista atual de tickets e options daquele evento: exija uma opcao ativa e disponivel de meia-entrada para o MESMO setor. Nunca aplique uma regra geral de criancas, estudantes ou idosos a Primeira Fileira, camarote ou qualquer outro setor sem essa verificacao. Se nao houver essa modalidade publicada, diga apenas que nao a encontrou entre as opcoes disponiveis; nao afirme que a lei retira o direito da pessoa por se tratar de setor privilegiado. Se houver duvida ou contestacao legal, use HANDOFF. Nunca diga que a idade federal para idoso e 65 anos.
7.9. Quando o cliente perguntar a taxa de um ingresso, identifique o evento e o ingresso pela conversa, pelos pedidos e pelos dados de activeEvents. Informe exatamente basePrice, serviceFee e o total para uma unidade. Se houver ambiguidade real entre eventos ou setores, faca uma unica pergunta curta antes de responder.
8. Para pedido pendente, pode fornecer somente o orderUrl existente no contexto.
9. Se faltar apenas uma informacao simples para localizar evento, setor, quantidade ou pedido, pergunte ao cliente antes de usar HANDOFF. Use HANDOFF quando o dado nao existe no sistema, ha conflito real ou a operacao exige uma pessoa.
10. Nao prometa prazo ou acao futura que nao esteja garantida.
11. Nao repita saudacoes em todas as mensagens. Responda ao ponto, em no maximo 650 caracteres, com no maximo uma pergunta.
12. SILENT so deve ser usado para mensagem vazia, figurinha sem contexto, confirmacao final que nao exige resposta ou conteudo automatico.
13. Quando hasPreviousAiReply for falso e a resposta for AUTO_REPLY, termine com: "Se preferir, escreva falar com atendente."
14. Quando o cliente pedir uma pessoa ou atendente, use HANDOFF. O sistema tambem possui uma deteccao direta para esse pedido.
15. ${pendingHumanRequest ? "Existe um pedido anterior de atendimento humano, mas nenhum atendente entrou na conversa. Se a nova duvida puder ser respondida com seguranca pelo contexto, use AUTO_REPLY normalmente. Nao use HANDOFF apenas por causa do pedido anterior; o sistema oferecera o atendente novamente depois da resposta." : "Nao existe pedido anterior pendente de atendimento humano."}

SAIDA
AUTO_REPLY quando puder responder com seguranca.
HANDOFF quando uma pessoa precisar assumir; nesse caso escreva uma mensagem curta dizendo que encaminhou para a equipe, sem inventar prazo.
SILENT quando nenhuma resposta for necessaria.`;
}

async function requestDecision(
  userText: string,
  context: Awaited<ReturnType<typeof loadSupportContext>>,
  pendingHumanRequest = false,
) {
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
        { role: "developer", content: developerInstructions(pendingHumanRequest) },
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
  if (!shouldProcessWhatsAppAiState(state)) {
    await markInboundAi({ id: inbound.id, webhookPayload: inbound.webhookPayload, status: "SKIPPED", reason: state.reason });
    return;
  }
  if (isHumanHandoffRequest(message.text.body)) {
    const reply =
      "Claro. Encaminhei sua conversa para um atendente da TCR Ingressos. Nosso atendimento humano responde em horário comercial e continuará por aqui assim que estiver disponível.";
    await setWhatsAppAiConversationState({
      organizationId: inbound.organizationId,
      phone: message.from,
      mode: "HANDOFF",
      reason: "Cliente solicitou atendimento humano."
    });
    await sendWhatsAppTextMessage({
      to: message.from,
      text: reply,
      organizationId: inbound.organizationId,
      source: AI_SOURCE,
      metadata: { outcome: "HANDOFF", topic: "atendimento_humano", inboundProviderMessageId: message.id }
    });
    await markInboundAi({
      id: inbound.id,
      webhookPayload: inbound.webhookPayload,
      status: "COMPLETED",
      outcome: "HANDOFF",
      topic: "atendimento_humano",
      reason: "Cliente solicitou atendimento humano."
    });
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
    const pendingHumanRequest = state.mode === "HANDOFF";
    const modelDecision = await requestDecision(
      message.text.body.trim(),
      context,
      pendingHumanRequest,
    );
    const decision = guardPublishedHalfPriceAnswer({
      customerMessage: message.text.body.trim(),
      decision: modelDecision,
      events: context.activeEvents
    });
    if (decision.outcome === "HANDOFF") {
      await setWhatsAppAiConversationState({
        organizationId: inbound.organizationId,
        phone: message.from,
        mode: "HANDOFF",
        reason: decision.reason
      });
    }
    if (pendingHumanRequest && decision.outcome === "AUTO_REPLY") {
      await setWhatsAppAiConversationState({
        organizationId: inbound.organizationId,
        phone: message.from,
        mode: "ACTIVE",
        reason: "A IA respondeu com segurança à dúvida enviada após a solicitação de atendente."
      });
    }
    if (decision.outcome !== "SILENT" && decision.reply) {
      await sendWhatsAppTextMessage({
        to: message.from,
        text:
          pendingHumanRequest && decision.outcome === "AUTO_REPLY"
            ? resolvedHandoffReply(decision.reply)
            : decision.reply,
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
    await setWhatsAppAiConversationState({
      organizationId: inbound.organizationId,
      phone: message.from,
      mode: "HANDOFF",
      reason: "A IA não conseguiu responder com segurança; atendimento humano solicitado."
    });
    await markInboundAi({ id: inbound.id, webhookPayload: inbound.webhookPayload, status: "FAILED", error: detail.slice(0, 500) });
  }
}

export async function processWhatsAppSupportAiPayload(payload: unknown) {
  const body = payload as MetaWebhookPayload;
  const messages = body.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages || []) || []) || [];
  for (const message of messages) await processInboundMessage(message);
}

export const WHATSAPP_AI_SOURCE = AI_SOURCE;
