import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function plainText(payload: Prisma.JsonValue | null) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

function redact(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-?\d{2}\b/g, "[documento]")
    .slice(0, 1200);
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "";
}

export async function proposeSupportKnowledgeFromHumanReply(input: {
  organizationId: string;
  eventId: string | null;
  providerMessageId: string;
  adminUserId: string;
  adminName: string;
  phone: string;
}) {
  if (!/\blucas\b/i.test(input.adminName) || !input.eventId || !process.env.OPENAI_API_KEY) return;
  const sent = await prisma.whatsAppMessageLog.findFirst({
    where: { organizationId: input.organizationId, providerMessageId: input.providerMessageId, status: { in: ["SENT", "DELIVERED", "READ"] } },
    select: { id: true, payload: true, createdAt: true }
  });
  if (!sent || !plainText(sent.payload)) return;
  const existing = await prisma.whatsAppSupportKnowledge.findUnique({ where: { sourceMessageId: sent.id }, select: { id: true } });
  if (existing) return;
  const received = await prisma.whatsAppMessageLog.findFirst({
    where: {
      organizationId: input.organizationId,
      recipientPhone: input.phone,
      status: "RECEIVED",
      createdAt: { lte: sent.createdAt, gte: new Date(sent.createdAt.getTime() - 48 * 60 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    select: { webhookPayload: true }
  });
  const customerPayload = received?.webhookPayload;
  const customerText = customerPayload && typeof customerPayload === "object" && !Array.isArray(customerPayload)
    ? (customerPayload.text && typeof customerPayload.text === "object" && !Array.isArray(customerPayload.text)
      ? String((customerPayload.text as Record<string, unknown>).body || "") : "") : "";
  if (!customerText.trim()) return;
  const event = await prisma.event.findFirst({
    where: { id: input.eventId, organizationId: input.organizationId },
    select: { title: true, importantInfo: true, lots: { select: { name: true, description: true, admissionsPerUnit: true } } }
  });
  if (!event) return;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.WHATSAPP_AI_MODEL?.trim() || "gpt-5.4-mini",
      reasoning: { effort: "low" },
      max_output_tokens: 300,
      input: [
        { role: "developer", content: "Extraia uma regra de atendimento reutilizavel somente se a resposta do atendente trouxer um fato comercial claro e verificavel sobre este evento. Nao extraia estilo, saudacoes, dados pessoais, preco dinamico, estoque, pagamento individual, promessa ou regra legal nao comprovada. Se houver conflito com dados do evento, retorne shouldSuggest=false. Nunca generalize uma regra de um evento para outro. Responda em JSON." },
        { role: "user", content: JSON.stringify({ customerQuestion: redact(customerText), humanAnswer: redact(plainText(sent.payload)), event }) }
      ],
      text: { format: { type: "json_schema", name: "support_knowledge_suggestion", strict: true, schema: {
        type: "object", additionalProperties: false,
        properties: { shouldSuggest: { type: "boolean" }, topic: { type: "string" }, question: { type: "string" }, answer: { type: "string" } },
        required: ["shouldSuggest", "topic", "question", "answer"]
      } } }
    })
  });
  if (!response.ok) throw new Error(`Falha ao analisar atendimento: HTTP ${response.status}`);
  const parsed = JSON.parse(responseText(await response.json())) as { shouldSuggest: boolean; topic: string; question: string; answer: string };
  if (!parsed.shouldSuggest || !parsed.topic.trim() || !parsed.question.trim() || !parsed.answer.trim()) return;
  const topic = parsed.topic.trim().toLocaleLowerCase("pt-BR").slice(0, 120);
  const sameTopic = await prisma.whatsAppSupportKnowledge.findFirst({
    where: { organizationId: input.organizationId, eventId: input.eventId, topic, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true }
  });
  if (sameTopic) return;
  await prisma.whatsAppSupportKnowledge.create({
    data: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      topic,
      question: redact(parsed.question).slice(0, 300),
      answer: redact(parsed.answer).slice(0, 1000),
      sourceMessageId: sent.id,
      sourceAdminId: input.adminUserId
    }
  });
}

export async function loadApprovedSupportKnowledge(organizationId: string, eventIds: string[]) {
  return prisma.whatsAppSupportKnowledge.findMany({
    where: { organizationId, status: "APPROVED", OR: [{ eventId: null }, { eventId: { in: eventIds } }] },
    orderBy: { reviewedAt: "desc" }, take: 80,
    select: { eventId: true, topic: true, question: true, answer: true }
  });
}
