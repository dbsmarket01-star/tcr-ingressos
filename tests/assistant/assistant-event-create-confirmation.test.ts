import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  proposal: vi.fn(async () => ({ kind: "EVENT_CREATE", id: "proposal-1", eventId: "", eventTitle: "Show Teste",
    draft: { title: "Show Teste", slug: "show-teste-2026", description: "Apresentação.", startsAt: "2026-11-30T23:00:00.000Z",
      venueName: "Teatro Municipal", venueAddress: "Rua Central, 100", city: "Sorocaba", state: "SP", bannerUrl: "", eventMapImageUrl: "" } })),
  createEvent: vi.fn(async () => ({ id: "event-new" })),
  findFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
  findUnique: vi.fn(async () => ({ id: "event-new", title: "Show Teste", slug: "show-teste-2026", status: "DRAFT" })),
  save: vi.fn(async () => ({ id: "message-1", role: "assistant", text: "Rascunho criado." }))
}));

vi.mock("@/features/auth/auth.service", () => ({
  canAccessArea: () => true, canAccessEvent: () => true,
  getCurrentAdmin: async () => ({ id: "admin-1", role: "OWNER", organizationId: "org-1" })
}));
vi.mock("@/features/assistant/admin-assistant.service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/assistant/admin-assistant.service")>(),
  answerAssistant: vi.fn(), discardAssistantProposal: vi.fn(), getAssistantProposal: mocks.proposal,
  getPendingAssistantProposal: vi.fn(), listAssistantMessages: vi.fn(), saveAssistantConfirmation: mocks.save
}));
vi.mock("@/features/events/event.service", () => ({ createEvent: mocks.createEvent, updateEventStatus: vi.fn() }));
vi.mock("@/features/lots/lot.service", () => ({ updateTicketLotPricing: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  organization: { findUnique: async () => ({ slug: "tcr-ingressos" }) },
  adminAuditLog: { findFirst: vi.fn(async () => null) },
  event: { findFirst: mocks.findFirst, findUnique: mocks.findUnique }
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/admin/assistant/route";

const request = () => new NextRequest("https://produtor.tcringressos.app.br/api/admin/assistant", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://produtor.tcringressos.app.br", host: "produtor.tcringressos.app.br" },
  body: JSON.stringify({ type: "confirm", proposalId: "proposal-1" })
});

describe("assistant event creation confirmation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findFirst.mockResolvedValue(null); });

  it("creates only a draft and verifies its saved status", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: "Show Teste", status: "DRAFT" }), "org-1");
    expect(mocks.findUnique).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("rejects an existing slug without creating a duplicate", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "existing" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
