import { beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppMessageType } from "@prisma/client";
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  whatsAppMessageLog: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
  adminAuditLog: { findMany: vi.fn() }
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/features/ai/whatsapp-support-ai.service", () => ({ resolveWhatsAppAiConversationMode: vi.fn(() => "ACTIVE") }));
import { clearCrmWhatsAppInboxCache, getCrmWhatsAppConversation, getCrmWhatsAppInbox } from "@/features/crm/whatsapp-chat.service";
const message = {
  id: "ai-message", orderId: null, eventId: null, recipientName: "Contato teste", recipientPhone: "5511999999999",
  type: "AI_ASSISTANT", status: "SENT", templateName: null, payload: { text: "Resposta da IA" },
  webhookPayload: null, createdAt: new Date("2026-09-30T16:00:00Z"), errorMessage: null
};
beforeEach(() => {
  vi.clearAllMocks(); clearCrmWhatsAppInboxCache();
  db.whatsAppMessageLog.findMany.mockResolvedValue([message]);
  db.$queryRaw.mockResolvedValue([message]);
  db.order.findMany.mockResolvedValue([]); db.adminAuditLog.findMany.mockResolvedValue([]);
});
describe("AI messages in WhatsApp admin", () => {
  it("generates a Prisma client that recognizes the existing database value", () => {
    expect(Object.values(WhatsAppMessageType)).toContain("AI_ASSISTANT");
  });
  it("includes AI messages in the inbox query and renders their preview", async () => {
    const inbox = await getCrmWhatsAppInbox({ organizationId: "org_test" });
    expect(db.$queryRaw).toHaveBeenCalledWith(expect.objectContaining({ values: expect.arrayContaining(["org_test"]) }));
    expect(inbox[0].latestMessage).toBe("Resposta da IA");
  });
  it("renders an existing AI response in the conversation without suppressing it", async () => {
    const result = await getCrmWhatsAppConversation({ organizationId: "org_test", phone: "5511999999999" });
    expect(result.messages).toEqual([expect.objectContaining({ content: "Resposta da IA", direction: "outbound" })]);
    expect(db.whatsAppMessageLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org_test" }) }));
  });
  it("keeps human reply history while explicit placement removes it from the human queue", async () => {
    const humanMessage = { ...message, id: "human-message", type: "BULK", payload: { text: "Atendimento", humanAdminUserId: "admin-1" } };
    db.$queryRaw.mockResolvedValue([humanMessage]);
    db.whatsAppMessageLog.findMany.mockResolvedValue([humanMessage]);
    db.adminAuditLog.findMany.mockImplementation(({ where }) =>
      where.action?.in?.includes("WHATSAPP_HUMAN_QUEUE_HIDDEN") ? [
        { action: "WHATSAPP_HUMAN_QUEUE_HIDDEN", entityId: "org_test:11999999999", metadata: {}, createdAt: new Date("2026-10-20T12:00:00Z") },
        { action: "WHATSAPP_CLOSED_ENABLED", entityId: "org_test:11999999999", metadata: {}, createdAt: new Date("2026-10-20T12:00:00Z") }
      ] : []);
    const inbox = await getCrmWhatsAppInbox({ organizationId: "org_test" });
    expect(inbox[0]).toMatchObject({ hasHumanReply: true, humanQueueHidden: true, isClosed: true, closedManually: true });
  });
});
