import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  admin: { id: "admin-1", role: "OWNER", organizationId: "org-1" },
  proposal: vi.fn(),
  apply: vi.fn(),
  save: vi.fn(async () => ({ id: "message-1", role: "assistant", text: "Alteração confirmada." })),
  canAccessArea: vi.fn(() => true),
  canAccessEvent: vi.fn(() => true),
  event: vi.fn(async () => ({ id: "event-1", title: "Fernandinho", slug: "fernandinho" }))
}));

vi.mock("@/features/auth/auth.service", () => ({ getCurrentAdmin: async () => mocks.admin, canAccessArea: mocks.canAccessArea, canAccessEvent: mocks.canAccessEvent }));
vi.mock("@/features/assistant/admin-assistant.service", () => ({ answerAssistant: vi.fn(), discardAssistantProposal: vi.fn(), getAssistantImage: vi.fn(), getAssistantProposal: mocks.proposal, getPendingAssistantProposal: vi.fn(), listAssistantMessages: vi.fn(), saveAssistantConfirmation: mocks.save }));
vi.mock("@/features/lots/lot.service", () => ({ applyAssistantLotChanges: mocks.apply, updateTicketLotPricing: vi.fn() }));
vi.mock("@/features/events/event.service", () => ({ updateEventStatus: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { organization: { findUnique: async () => ({ slug: "tcr-ingressos" }) }, adminAuditLog: { findFirst: async () => null }, event: { findFirst: mocks.event } } }));
vi.mock("@/features/assistant/assistant-public-verification",()=>({verifyAssistantPublicTickets:async()=>({ok:true,detail:"Página conferida",url:"https://www.tcringressos.app.br/evento/fernandinho"})}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/assistant/assistant-resolution", () => ({ claimAssistantResolution: vi.fn(async () => true) }));

import { POST } from "@/app/api/admin/assistant/route";

function request() {
  return new NextRequest("https://produtor.tcringressos.app.br/api/admin/assistant", { method: "POST", headers: { "content-type": "application/json", origin: "https://produtor.tcringressos.app.br", host: "produtor.tcringressos.app.br" }, body: JSON.stringify({ type: "confirm", proposalId: "proposal-1" }) });
}

describe("assistant lot changes confirmation", () => {
  const changes = [{ operation: "UPDATE", lotId: "lot-1", name: "NOVO", priceInCents: 10000 }];
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.proposal.mockResolvedValue({ kind: "LOT_CHANGES", id: "proposal-1", eventId: "event-1", eventTitle: "Fernandinho", changes });
    mocks.canAccessArea.mockReturnValue(true); mocks.canAccessEvent.mockReturnValue(true);
  });
  it("applies only the confirmed event and changes", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith("event-1", changes);
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("refuses event access and makes no changes", async () => {
    mocks.canAccessEvent.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("does not mark failed work as completed", async () => {
    mocks.apply.mockRejectedValueOnce(new Error("O ingresso mudou desde a proposta."));
    expect((await POST(request())).status).toBe(409);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
