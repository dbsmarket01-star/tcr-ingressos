import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), count: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditLog: { findFirst: mocks.findFirst },
    whatsAppMessageLog: { count: mocks.count }
  }
}));

import { getWhatsAppAiConversationState } from "@/features/ai/whatsapp-support-ai.service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_AI_ENABLED", "true");
  vi.stubEnv("WHATSAPP_AI_MONTHLY_MESSAGE_LIMIT", "2500");
});

it("resumes a limit-only handoff below the new ceiling for the same organization", async () => {
  mocks.findFirst.mockResolvedValue({
    action: "WHATSAPP_AI_HANDOFF",
    metadata: { reason: "Limite mensal da IA atingido (2005/2000)." },
    createdAt: new Date("2026-11-26T13:00:00Z")
  });
  mocks.count.mockResolvedValue(2005);

  const state = await getWhatsAppAiConversationState("org-tcr", "5511999999999");

  expect(state.mode).toBe("ACTIVE");
  expect(mocks.findFirst.mock.calls[0][0].where.entityId).toBe("org-tcr:11999999999");
  expect(mocks.count.mock.calls[0][0].where.organizationId).toBe("org-tcr");
});

it("keeps the handoff when the new ceiling is reached", async () => {
  mocks.findFirst.mockResolvedValue({
    action: "WHATSAPP_AI_HANDOFF",
    metadata: { reason: "Limite mensal da IA atingido (2005/2000)." },
    createdAt: new Date("2026-11-26T13:00:00Z")
  });
  mocks.count.mockResolvedValue(2500);

  expect((await getWhatsAppAiConversationState("org-tcr", "5511999999999")).mode).toBe("HANDOFF");
});

it("preserves a later human pause without consulting or resetting the AI budget", async () => {
  mocks.findFirst.mockResolvedValue({
    action: "WHATSAPP_AI_PAUSED",
    metadata: { reason: "Atendente humano assumiu a conversa.", pausedUntil: "2026-11-27T13:00:00Z" },
    createdAt: new Date("2026-11-26T13:00:00Z")
  });

  expect((await getWhatsAppAiConversationState("org-tcr", "5511999999999")).mode).toBe("PAUSED");
  expect(mocks.count).not.toHaveBeenCalled();
});
