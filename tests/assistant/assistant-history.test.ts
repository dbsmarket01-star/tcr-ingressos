import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(async () => []) }));
vi.mock("@/lib/prisma", () => ({ prisma: { adminAuditLog: { findMany: mocks.findMany } } }));
vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
import { listAssistantMessages } from "@/features/assistant/admin-assistant.service";
describe("assistant shared history scope", () => {
  it("does not let a pagination cursor widen the selected day", async () => {
    await listAssistantMessages({ id: "a", organizationId: "org" } as never, { period: "date", date: "2026-11-09", before: "2026-11-30T00:00:00Z" });
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({
      metadata: { path: ["organizationId"], equals: "org" },
      createdAt: { gte: new Date("2026-11-09T03:00:00Z"), lt: new Date("2026-11-10T03:00:00Z") }
    }) }));
  });
});
