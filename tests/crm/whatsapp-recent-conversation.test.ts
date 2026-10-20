import { beforeEach, describe, expect, it, vi } from "vitest";

const findMessages = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  prisma: { whatsAppMessageLog: { findMany: findMessages } }
}));
vi.mock("@/features/ai/whatsapp-support-ai.service", () => ({
  resolveWhatsAppAiConversationMode: vi.fn(() => "ACTIVE")
}));

import { getCrmWhatsAppConversation } from "@/features/crm/whatsapp-chat.service";

describe("WhatsApp conversation recency", () => {
  beforeEach(() => findMessages.mockReset());

  it("loads the newest messages and displays them oldest-to-newest", async () => {
    findMessages.mockResolvedValue([
      {
        id: "newest", status: "RECEIVED", type: "BULK", payload: { text: "Mensagem mais nova" },
        webhookPayload: null, templateName: null, errorMessage: null,
        createdAt: new Date("2026-10-10T12:01:00Z")
      },
      {
        id: "older", status: "RECEIVED", type: "BULK", payload: { text: "Mensagem anterior" },
        webhookPayload: null, templateName: null, errorMessage: null,
        createdAt: new Date("2026-10-10T12:00:00Z")
      }
    ]);

    const conversation = await getCrmWhatsAppConversation({
      phone: "5511999990000",
      organizationId: "org-1"
    });

    expect(findMessages).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 81
    }));
    expect(conversation.messages.map((message) => message.id)).toEqual(["older", "newest"]);
    expect(conversation.historyHasMore).toBe(false);
    expect(conversation.historyCursor).toEqual({ at: "2026-10-10T12:00:00.000Z", id: "older" });
  });

  it("uses a stable cursor and returns only the requested history page", async () => {
    findMessages.mockResolvedValue(Array.from({ length: 81 }, (_, index) => ({
      id: `message-${String(81 - index).padStart(3, "0")}`,
      status: "RECEIVED", type: "BULK", payload: { text: "Mensagem" },
      webhookPayload: null, templateName: null, errorMessage: null,
      createdAt: new Date("2026-10-10T12:00:00Z")
    })));

    const conversation = await getCrmWhatsAppConversation({
      phone: "5511999990000", organizationId: "org-1",
      beforeAt: new Date("2026-10-11T12:00:00Z"), beforeId: "cursor-id"
    });

    expect(conversation.messages).toHaveLength(80);
    expect(conversation.historyHasMore).toBe(true);
    expect(conversation.historyCursor?.id).toBe("message-002");
    expect(conversation.messages[0]?.id).toBe("message-002");
    expect(findMessages).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: [{ OR: [
        { createdAt: { lt: new Date("2026-10-11T12:00:00Z") } },
        { createdAt: new Date("2026-10-11T12:00:00Z"), id: { lt: "cursor-id" } }
      ] }] })
    }));
  });
});
