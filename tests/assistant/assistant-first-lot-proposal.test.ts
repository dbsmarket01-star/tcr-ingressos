import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAudit: vi.fn(async (args: { data: { action: string } }) => ({ id: args.data.action === "ADMIN_ASSISTANT_PROPOSAL" ? "proposal-1" : "message-1", createdAt: new Date("2026-11-09T12:00:00.000Z") })),
  findEvents: vi.fn(async (args: { select?: { lots?: unknown } }) => {
    const event = { id: "event-1", title: "Show Teste", city: "Sorocaba", slug: "show-teste", startsAt: new Date("2026-11-30T23:00:00.000Z"), status: "DRAFT" };
    return args.select?.lots ? [{ ...event, updatedAt: new Date("2026-11-09T12:00:00.000Z"), lots: [] }] : [event];
  })
}));

vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  adminAuditLog: { findFirst: async () => null, findMany: async () => [], create: mocks.createAudit },
  event: { findMany: mocks.findEvents }
} }));

import { answerAssistant } from "@/features/assistant/admin-assistant.service";

function decision(serviceFeeBps: number | undefined) {
  return { reply: "Vou criar o primeiro ingresso.", action: "LOT_CHANGES", eventId: "event-1", lotId: "",
    newPriceInCents: 0, newStatus: "", changes: [{ operation: "CREATE", lotId: "", templateLotId: "", name: "Pista inteira", description: "Em pé", priceInCents: 10000, totalQuantity: 100, status: "DRAFT", serviceFeeBps, cardInterestBpsPerInstallment: 200, cardInterestStartsAtInstallment: 2 }], eventChanges: [],
    eventDraft: { title: "", slug: "", description: "", startsAt: "", venueName: "", venueAddress: "", city: "", state: "", bannerUrl: "", eventMapImageUrl: "" } };
}

describe("assistant first lot proposal", () => {
  it("proposes a first ticket only with explicit fee settings", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-placeholder");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify(decision(1500)) }) } as Response);
    try {
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as Parameters<typeof answerAssistant>[0], "Crie Pista inteira no Show Teste em Sorocaba por R$ 100, taxa 15%, cartão 2% desde 2 parcelas, estoque 100");
      expect(result.proposal?.kind).toBe("LOT_CHANGES");
      expect(result.proposal?.kind === "LOT_CHANGES" ? result.proposal.changes[0]?.serviceFeeBps : null).toBe(1500);
    } finally { fetchSpy.mockRestore(); vi.unstubAllEnvs(); }
  });

  it("rejects a proposed first ticket when fees were omitted", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-placeholder");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify(decision(undefined)) }) } as Response);
    try {
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as Parameters<typeof answerAssistant>[0], "Crie Pista inteira no Show Teste em Sorocaba por R$ 100, estoque 100");
      expect(result.proposal).toBeNull();
    } finally { fetchSpy.mockRestore(); vi.unstubAllEnvs(); }
  });
});
