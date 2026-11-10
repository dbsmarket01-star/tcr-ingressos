import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalUpdatedAt = new Date("2026-11-09T12:00:00.000Z");
const mocks = vi.hoisted(() => ({
  proposal: vi.fn(async () => ({ kind: "EVENT_DETAILS_CHANGE", id: "proposal-1", eventId: "event-1", eventTitle: "Show Teste",
    expectedUpdatedAt: "2026-11-09T12:00:00.000Z", changes: [{ field: "venueName", oldValue: "Local Antigo", value: "Teatro Municipal" }] })),
  event: vi.fn(async () => ({ id: "event-1", slug: "show-teste", title: "Show Teste", updatedAt: new Date("2026-11-09T12:00:00.000Z"),
    startsAt: new Date("2026-11-30T23:00:00.000Z"), endsAt: null, doorsOpenAt: null, bannerUrl: null, eventMapImageUrl: null })),
  updateMany: vi.fn(async () => ({ count: 1 })),
  image: vi.fn(async () => ({ bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mime: "image/png" })),
  upload: vi.fn(async () => "https://storage.example.com/banner.png"),
  verified: vi.fn(async (): Promise<{ id: string; slug: string; title: string; venueName?: string; bannerUrl?: string }> => ({ id: "event-1", slug: "show-teste", title: "Show Teste", venueName: "Teatro Municipal" })),
  save: vi.fn(async () => ({ id: "message-1", role: "assistant", text: "Alteração confirmada." }))
}));

vi.mock("@/features/auth/auth.service", () => ({
  canAccessArea: () => true, canAccessEvent: () => true,
  getCurrentAdmin: async () => ({ id: "admin-1", role: "OWNER", organizationId: "org-1" })
}));
vi.mock("@/features/assistant/admin-assistant.service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/assistant/admin-assistant.service")>(),
  answerAssistant: vi.fn(), discardAssistantProposal: vi.fn(), getAssistantProposal: mocks.proposal,
  getAssistantImage: mocks.image, getPendingAssistantProposal: vi.fn(), listAssistantMessages: vi.fn(), saveAssistantConfirmation: mocks.save
}));
vi.mock("@/features/uploads/local-upload.service", () => ({ savePublicImageUpload: mocks.upload }));
vi.mock("@/features/events/event.service", () => ({ createEvent: vi.fn(), updateEventStatus: vi.fn() }));
vi.mock("@/features/lots/lot.service", () => ({ updateTicketLotPricing: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  organization: { findUnique: async () => ({ slug: "tcr-ingressos" }) },
  adminAuditLog: { findFirst: vi.fn(async () => null) },
  event: { findFirst: mocks.event, updateMany: mocks.updateMany, findUnique: mocks.verified }
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/features/assistant/assistant-resolution", () => ({ claimAssistantResolution: vi.fn(async () => true) }));

import { POST } from "@/app/api/admin/assistant/route";

const request = () => new NextRequest("https://produtor.tcringressos.app.br/api/admin/assistant", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://produtor.tcringressos.app.br", host: "produtor.tcringressos.app.br" },
  body: JSON.stringify({ type: "confirm", proposalId: "proposal-1" })
});

describe("assistant event details confirmation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.event.mockResolvedValue({ id: "event-1", slug: "show-teste", title: "Show Teste", updatedAt: originalUpdatedAt,
    startsAt: new Date("2026-11-30T23:00:00.000Z"), endsAt: null, doorsOpenAt: null, bannerUrl: null, eventMapImageUrl: null }); });

  it("updates the selected field and checks the saved value", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { venueName: "Teatro Municipal" } }));
    expect(mocks.verified).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("refuses a proposal after another editor has changed the event", async () => {
    mocks.event.mockResolvedValueOnce({ id: "event-1", slug: "show-teste", title: "Show Teste", updatedAt: new Date("2026-11-09T13:00:00.000Z"),
      startsAt: new Date("2026-11-30T23:00:00.000Z"), endsAt: null, doorsOpenAt: null, bannerUrl: null, eventMapImageUrl: null });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("uploads an attached banner only on confirmation and checks the saved URL", async () => {
    mocks.proposal.mockResolvedValueOnce({ kind: "EVENT_DETAILS_CHANGE", id: "proposal-1", eventId: "event-1", eventTitle: "Show Teste",
      expectedUpdatedAt: "2026-11-09T12:00:00.000Z", changes: [{ field: "bannerUrl", oldValue: "", value: "assistant-image:image123" }] });
    mocks.verified.mockResolvedValueOnce({ id: "event-1", slug: "show-teste", title: "Show Teste", bannerUrl: "https://storage.example.com/banner.png" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.image).toHaveBeenCalledWith(expect.anything(), "image123");
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { bannerUrl: "https://storage.example.com/banner.png" } }));
  });
});
