import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  log: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  audit: { findFirst: vi.fn(), create: vi.fn() }, send: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  whatsAppMessageLog: m.log, adminAuditLog: m.audit,
  order: { findMany: async () => [] }, companySettings: { findUnique: async () => null },
  paymentSplitRule: { findMany: async () => [] }, event: { findMany: async () => [] }
}}));
vi.mock("@/features/whatsapp/whatsapp.service", () => ({ sendWhatsAppTextMessage: m.send }));
vi.mock("@/features/whatsapp/ad-sales-journey", () => ({ isAuthorizedAdSalesTestKeyword: () => false, processAdSalesJourney: async () => false }));
vi.mock("@/features/whatsapp/sorocaba-sales-journey", () => ({ isSorocabaAdGreeting: () => false, processSorocabaSalesJourney: async () => false }));
vi.mock("@/features/ai/whatsapp-support-knowledge.service", () => ({ loadApprovedSupportKnowledge: async () => [] }));
import { processWhatsAppSupportAiPayload } from "@/features/ai/whatsapp-support-ai.service";
const inbound = { id: "test-only", from: "5511999990000", type: "text", text: { body: "Quais as formas de pagamento?" } };
const failure = { action: "WHATSAPP_AI_HANDOFF", metadata: { reason: "A IA não conseguiu responder com segurança; atendimento humano solicitado." } };
const receive = () => processWhatsAppSupportAiPayload({ entry: [{ changes: [{ value: { messages: [inbound] } }] }] });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("WHATSAPP_AI_ENABLED", "true"); vi.stubEnv("OPENAI_API_KEY", "test-only");
  m.log.findFirst.mockResolvedValueOnce({ id: "log", organizationId: "org", webhookPayload: inbound }).mockResolvedValue(null);
  m.log.findMany.mockResolvedValue([]); m.log.count.mockResolvedValue(0); m.log.updateMany.mockResolvedValue({ count: 1 });
  m.audit.findFirst.mockResolvedValue(failure);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("responde após uma falha técnica anterior e usa orçamento próprio do WhatsApp", async () => {
  vi.stubEnv("OPENAI_CHAT_MAX_OUTPUT_TOKENS", "360");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({ outcome: "AUTO_REPLY", reply: "Aceitamos Pix e cartão.", reason: "Informação disponível.", topic: "pagamento" }) })));
  vi.stubGlobal("fetch", fetchMock);
  await receive();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_output_tokens).toBe(1200);
  expect(m.send).toHaveBeenCalledOnce();
  expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ text: "Aceitamos Pix e cartão." }));
  expect(m.audit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "WHATSAPP_AI_ENABLED" }) }));
});
it("avisa e encaminha quando não há crédito, sem tentar novamente a API", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('no credits remaining', { status: 429 }));
  vi.stubGlobal("fetch", fetchMock); await receive();
  expect(fetchMock).toHaveBeenCalledOnce(); expect(m.send).toHaveBeenCalledOnce();
  expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ outcome: "HANDOFF", topic: "ia_sem_creditos" }) }));
});
it("não envia resposta se um atendente assumir enquanto a IA gera o texto", async () => {
  m.audit.findFirst.mockResolvedValueOnce(failure).mockResolvedValue({ action: "WHATSAPP_AI_PAUSED", metadata: { pausedUntil: new Date(Date.now()+3600000).toISOString() } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({ outcome: "AUTO_REPLY", reply: "Aceitamos Pix.", reason: "Informação disponível.", topic: "pagamento" }) }))));
  await receive(); expect(m.send).not.toHaveBeenCalled();
});
