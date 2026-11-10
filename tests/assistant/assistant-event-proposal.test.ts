import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAudit: vi.fn(async (args: { data: { action: string } }) => ({ id: args.data.action === "ADMIN_ASSISTANT_PROPOSAL" ? "proposal-1" : "message-1", createdAt: new Date("2026-11-09T12:00:00.000Z") })),
  findEvents: vi.fn(async (args: { select?: { lots?: unknown } }) => {
    const event = { id: "event-1", title: "Show Teste", city: "Sorocaba", slug: "show-teste", startsAt: new Date("2026-11-30T23:00:00.000Z"), status: "PUBLISHED" };
    return args.select?.lots ? [{ ...event, venueName: "Local Antigo", venueAddress: "Rua Antiga, 1", updatedAt: new Date("2026-11-09T12:00:00.000Z"), lots: [] }] : [event];
  })
}));

vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  adminAuditLog: { findFirst: async () => null, findMany: async () => [], create: mocks.createAudit },
  event: { findMany: mocks.findEvents }
} }));

import { answerAssistant } from "@/features/assistant/admin-assistant.service";

describe("assistant event proposal", () => {
  beforeEach(() => vi.clearAllMocks());
  it("turns an explicit venue change into a confirmable proposal without writing the event", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-placeholder");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify({
      reply: "Posso trocar o local do Show Teste.", action: "EVENT_DETAILS_CHANGE", eventId: "event-1", lotId: "",
      newPriceInCents: 0, newStatus: "", changes: [], eventChanges: [{ field: "venueName", value: "Teatro Municipal" }],
      eventDraft: { title: "", slug: "", description: "", startsAt: "", venueName: "", venueAddress: "", city: "", state: "", bannerUrl: "", eventMapImageUrl: "" }
    }) }) } as Response);
    try {
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as Parameters<typeof answerAssistant>[0],
        "No Show Teste em Sorocaba, altere o local para Teatro Municipal");
      expect(result.proposal?.kind).toBe("EVENT_DETAILS_CHANGE");
      expect(result.proposal?.kind === "EVENT_DETAILS_CHANGE" ? result.proposal.changes[0]?.value : null).toBe("Teatro Municipal");
      expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "ADMIN_ASSISTANT_PROPOSAL" }) }));
    } finally { fetchSpy.mockRestore(); vi.unstubAllEnvs(); }
  });
  it("loads a tool-discovered event before validating a mutation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-placeholder");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify({
      reply: "Proposta", action: "EVENT_DETAILS_CHANGE", eventId: "event-1", eventChanges: [{ field: "venueName", value: "Teatro Novo" }]
    }) }) } as Response);
    try {
      // No event name in the current prompt and no prior conversation ranking.
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as never, "Altere o local do evento que você encontrou para Teatro Novo");
      expect(result.proposal?.kind).toBe("EVENT_DETAILS_CHANGE");
      expect(mocks.findEvents).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "event-1", organizationId: "org-1" } }));
    } finally { fetchSpy.mockRestore(); vi.unstubAllEnvs(); }
  });
  it("does not treat a request to analyze a banner as permission to replace it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-placeholder");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify({ reply: "Analisei o print.", action: "NONE" }) }) } as Response);
    try {
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as never,
        "Veja se o banner do Show Teste em Sorocaba está legível neste print", { name: "print.png", mime: "image/png", data: "test" });
      expect(result.proposal).toBeNull();
      expect(fetchSpy).toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); vi.unstubAllEnvs(); }
  });

});
