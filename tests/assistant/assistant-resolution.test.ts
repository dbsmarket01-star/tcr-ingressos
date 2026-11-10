import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { adminAuditLog: { create: mocks.create } } }));
import { claimAssistantResolution } from "@/features/assistant/assistant-resolution";
const admin = { id: "admin", organizationId: "org" };
describe("durable assistant resolution", () => {
  beforeEach(() => vi.resetAllMocks());
  it("permits only one execution when confirmation races cancellation/retry", async () => {
    const ids = new Set<string>();
    mocks.create.mockImplementation(async ({ data }) => {
      if (ids.has(data.id)) throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
      ids.add(data.id); return data;
    });
    const results = await Promise.all([
      claimAssistantResolution(admin, "p1", "ADMIN_ASSISTANT_PROCESSING"),
      claimAssistantResolution(admin, "p1", "ADMIN_ASSISTANT_PROCESSING"),
      claimAssistantResolution(admin, "p1", "ADMIN_ASSISTANT_DISCARDED")
    ]);
    expect(results).toEqual([true, false, false]);
    expect(await claimAssistantResolution(admin, "p2", "ADMIN_ASSISTANT_PROCESSING")).toBe(true);
  });
  it("does not run after a database failure", async () => {
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    await expect(claimAssistantResolution(admin, "p", "ADMIN_ASSISTANT_PROCESSING")).rejects.toThrow("database unavailable");
  });
});
