import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  let savedStatus = "PUBLISHED";
  return {
    admin: { id: "admin-1", role: "OWNER", organizationId: "org-1" },
    canAccessArea: vi.fn(() => true),
    canAccessEvent: vi.fn(() => true),
    proposal: vi.fn(async () => ({ kind: "EVENT_STATUS_CHANGE", id: "proposal-1", eventId: "event-1", eventTitle: "Rodrigo Teaser em Ribeirão Pires", oldStatus: "PUBLISHED", newStatus: "UNPUBLISHED" })),
    resolved: vi.fn(async () => null),
    findEvent: vi.fn(async () => ({ id: "event-1", title: "Rodrigo Teaser em Ribeirão Pires", slug: "rodrigo-teaser-em-ribeirao-pires-2026", status: savedStatus })),
    readEvent: vi.fn(async () => ({ status: savedStatus })),
    updateStatus: vi.fn(async (_id: string, status: string) => { savedStatus = status; }),
    saveConfirmation: vi.fn(async () => ({ id: "message-1", role: "assistant", text: "Evento retirado do ar." })),
    reset: () => { savedStatus = "PUBLISHED"; }
  };
});

vi.mock("@/features/auth/auth.service", () => ({
  canAccessArea: mocks.canAccessArea, canAccessEvent: mocks.canAccessEvent,
  getCurrentAdmin: async () => mocks.admin
}));
vi.mock("@/features/assistant/admin-assistant.service", () => ({
  answerAssistant: vi.fn(), discardAssistantProposal: vi.fn(), getAssistantProposal: mocks.proposal,
  getPendingAssistantProposal: vi.fn(), listAssistantMessages: vi.fn(), saveAssistantConfirmation: mocks.saveConfirmation
}));
vi.mock("@/features/events/event.service", () => ({ updateEventStatus: mocks.updateStatus }));
vi.mock("@/features/lots/lot.service", () => ({ updateTicketLotPricing: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  organization: { findUnique: async () => ({ slug: "tcr-ingressos" }) },
  adminAuditLog: { findFirst: mocks.resolved },
  event: { findFirst: mocks.findEvent, findUnique: mocks.readEvent }
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/admin/assistant/route";

function request() {
  return new NextRequest("https://produtor.tcringressos.app.br/api/admin/assistant", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://produtor.tcringressos.app.br", host: "produtor.tcringressos.app.br" },
    body: JSON.stringify({ type: "confirm", proposalId: "proposal-1" })
  });
}

describe("assistant event status confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.reset(); mocks.canAccessArea.mockReturnValue(true);
    mocks.canAccessEvent.mockReturnValue(true); mocks.resolved.mockResolvedValue(null);
  });

  it("unpublishes only the selected event and verifies the saved status", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.updateStatus).toHaveBeenCalledWith("event-1", "UNPUBLISHED");
    expect(mocks.readEvent).toHaveBeenCalledOnce();
    expect(mocks.saveConfirmation).toHaveBeenCalledOnce();
  });

  it("refuses a stale status proposal", async () => {
    mocks.findEvent.mockResolvedValueOnce({ ...await mocks.findEvent(), status: "UNPUBLISHED" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it("refuses a user without event permission", async () => {
    mocks.canAccessArea.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it("refuses access to another event", async () => {
    mocks.canAccessEvent.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });
});
