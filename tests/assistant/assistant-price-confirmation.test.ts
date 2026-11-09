import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  let savedPrice = 14790;
  return {
    admin: { id: "admin-1", role: "OWNER", organizationId: "org-1" },
    canAccessArea: vi.fn((_role: string, _area: string) => true),
    canAccessEvent: vi.fn(() => true),
    getAssistantProposal: vi.fn(async () => ({ id: "proposal-1", eventId: "event-1", lotId: "lot-1", oldPriceInCents: 14790, newPriceInCents: 15790 })),
    saveAssistantConfirmation: vi.fn(async () => ({ id: "message-1", role: "assistant", text: "Preço alterado." })),
    findResolved: vi.fn(async () => null),
    findLot: vi.fn(async () => ({ id: "lot-1", name: "OURO - MEIA", priceInCents: savedPrice, serviceFeeBps: 1000, pixDiscountPercentBps: 0, pixDiscountFixedInCents: 0, cardInterestBpsPerInstallment: 0, cardInterestStartsAtInstallment: 1, event: { slug: "evento-teste", title: "Evento teste" } })),
    readLot: vi.fn(async () => ({ priceInCents: savedPrice })),
    updatePricing: vi.fn(async (_id: string, input: { priceInCents: number }) => { savedPrice = input.priceInCents; }),
    resetPrice: () => { savedPrice = 14790; }
  };
});

vi.mock("@/features/auth/auth.service", () => ({
  canAccessArea: mocks.canAccessArea, canAccessEvent: mocks.canAccessEvent,
  getCurrentAdmin: async () => mocks.admin
}));
vi.mock("@/features/assistant/admin-assistant.service", () => ({
  answerAssistant: vi.fn(), discardAssistantProposal: vi.fn(), getAssistantProposal: mocks.getAssistantProposal,
  getPendingAssistantProposal: vi.fn(), listAssistantMessages: vi.fn(), saveAssistantConfirmation: mocks.saveAssistantConfirmation
}));
vi.mock("@/features/lots/lot.service", () => ({ updateTicketLotPricing: mocks.updatePricing }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  organization: { findUnique: async () => ({ slug: "tcr-ingressos" }) },
  adminAuditLog: { findFirst: mocks.findResolved },
  ticketLot: { findFirst: mocks.findLot, findUnique: mocks.readLot }
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/admin/assistant/route";

function request() {
  return new NextRequest("https://produtor.tcringressos.app.br/api/admin/assistant", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://produtor.tcringressos.app.br", host: "produtor.tcringressos.app.br" },
    body: JSON.stringify({ type: "confirm", proposalId: "proposal-1" })
  });
}

describe("assistant price confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.resetPrice(); mocks.canAccessArea.mockReturnValue(true);
    mocks.findResolved.mockResolvedValue(null);
  });

  it("changes the exact lot and verifies the saved price", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.updatePricing).toHaveBeenCalledOnce();
    expect(mocks.updatePricing.mock.calls[0][0]).toBe("lot-1");
    expect(mocks.updatePricing.mock.calls[0][1].priceInCents).toBe(15790);
    expect(mocks.readLot).toHaveBeenCalledOnce();
    expect(mocks.saveAssistantConfirmation).toHaveBeenCalledOnce();
  });

  it("refuses a stale proposal without writing a new price", async () => {
    mocks.findLot.mockResolvedValueOnce({ ...await mocks.findLot(), priceInCents: 14990 });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.updatePricing).not.toHaveBeenCalled();
  });

  it("does not let a support-only user change event prices", async () => {
    mocks.canAccessArea.mockImplementation((_role, area) => area !== "EVENTS");
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.updatePricing).not.toHaveBeenCalled();
  });
});
