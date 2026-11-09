import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAudit: vi.fn(async () => ({ id: "message-1", createdAt: new Date("2026-11-09T12:00:00.000Z") })),
  findEvents: vi.fn(async (args: { select?: { lots?: unknown } }) => {
    const base = [
      { id: "event-old", title: "Fernandinho em Santo André", city: "Santo André", slug: "fernandinho-outubro", startsAt: new Date("2026-10-22T00:00:00.000Z"), status: "UNPUBLISHED" },
      { id: "event-new", title: "Fernandinho em Santo André", city: "Santo André", slug: "fernandinho-novembro", startsAt: new Date("2026-11-22T00:00:00.000Z"), status: "PUBLISHED" }
    ];
    return args.select?.lots ? base.map((event) => ({ ...event, lots: [], updatedAt: new Date("2026-11-09T12:00:00.000Z") })) : base;
  })
}));

vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  adminAuditLog: { findFirst: async () => null, findMany: async () => [], create: mocks.createAudit },
  event: { findMany: mocks.findEvents }
} }));

import { answerAssistant } from "@/features/assistant/admin-assistant.service";

describe("assistant event disambiguation", () => {
  it("asks which event to change instead of guessing between identical titles", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as Parameters<typeof answerAssistant>[0],
        "Altere o preço do ingresso do Fernandinho em Santo André para R$ 100,00");
      expect(result.proposal).toBeNull();
      expect(result.message.text).toContain("event-old");
      expect(result.message.text).toContain("event-new");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
