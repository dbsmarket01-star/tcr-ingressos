import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(async (args: { where: { id?: string; adminUserId?: string; action?: unknown } }) => {
    if (typeof args.where.action === "object") return null;
    if (args.where.adminUserId !== "lucas") return null;
    if (args.where.id === "proposal-lucas" || !args.where.id) return {
      id: "proposal-lucas", createdAt: new Date(), adminUserId: "lucas",
      metadata: { organizationId: "tcr", kind: "EVENT_STATUS_CHANGE", eventId: "event-1",
        eventTitle: "Show", oldStatus: "PUBLISHED", newStatus: "UNPUBLISHED" }
    };
    return null;
  })
}));

vi.mock("@/lib/prisma", () => ({ prisma: { adminAuditLog: { findFirst: mocks.findFirst } } }));
vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));

import { getAssistantProposal, getPendingAssistantProposal } from "@/features/assistant/admin-assistant.service";

describe("assistant proposal ownership", () => {
  const admin = (id: string) => ({ id, role: "OWNER", organizationId: "tcr" }) as Parameters<typeof getAssistantProposal>[0];

  it("does not expose Lucas's pending proposal to Diego", async () => {
    expect(await getPendingAssistantProposal(admin("diego"))).toBeNull();
    expect(await getPendingAssistantProposal(admin("lucas"))).toMatchObject({ id: "proposal-lucas" });
    expect(await getAssistantProposal(admin("diego"), "proposal-lucas")).toBeNull();
    expect(await getAssistantProposal(admin("lucas"), "proposal-lucas")).toMatchObject({ kind: "EVENT_STATUS_CHANGE" });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ adminUserId: "lucas" }) }));
  });
});
