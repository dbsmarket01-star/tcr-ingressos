import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(async (args: { data: { action: string } }) => ({ id: args.data.action === "ADMIN_ASSISTANT_PROPOSAL" ? "proposal-color" : "message-color", createdAt: new Date() })),
  events: vi.fn(async (args: { select?: { lots?: unknown } }) => {
    const event = { id: "event-1", title: "Show Teste", city: "Sorocaba", slug: "show-teste", startsAt: new Date("2026-11-30T23:00:00Z"), status: "PUBLISHED" };
    return args.select?.lots ? [{ ...event, updatedAt: new Date(), lots: [
      { id: "lot-1", name: "Cadeira Ouro - Meia Entrada", description: "", priceInCents: 15000, totalQuantity: 100, soldQuantity: 0, reservedQuantity: 0, status: "ACTIVE", highlightColor: "#D4A017" }
    ] }] : [event];
  })
}));

vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  adminAuditLog: { findFirst: async () => null, findMany: async () => [], create: mocks.create },
  event: { findMany: mocks.events }
} }));

import { answerAssistant, requestedLotColor } from "@/features/assistant/admin-assistant.service";

describe("assistant lot color proposal", () => {
  it("recognizes the target color after the ticket name", () => {
    expect(requestedLotColor("Mude a cor da Cadeira Ouro - Meia Entrada para verde")).toBe("#24865D");
    expect(requestedLotColor("Mude a cor da Cadeira Ouro - Meia Entrada para #123abc")).toBe("#123ABC");
  });

  it("proposes only the color change and preserves price, stock and status", async () => {
    const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as Parameters<typeof answerAssistant>[0],
      "No Show Teste em Sorocaba, mude a cor da Cadeira Ouro - Meia Entrada para verde");
    expect(result.proposal?.kind).toBe("LOT_CHANGES");
    if (result.proposal?.kind !== "LOT_CHANGES") return;
    expect(result.proposal.changes[0]).toMatchObject({ lotId: "lot-1", highlightColor: "#24865D", oldHighlightColor: "#D4A017", priceInCents: 15000, totalQuantity: 100, status: "ACTIVE" });
  });
});
