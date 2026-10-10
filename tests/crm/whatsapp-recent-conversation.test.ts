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
      orderBy: { createdAt: "desc" }, take: 80
    }));
    expect(conversation.messages.map((message) => message.id)).toEqual(["older", "newest"]);
  });
});
