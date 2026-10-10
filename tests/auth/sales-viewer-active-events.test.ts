import { describe, expect, it, vi } from "vitest";
import { buildDashboardEventWhere } from "@/features/dashboard/dashboard.service";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
describe("active events dashboard scope", () => {
  it("keeps organization and event access restrictions alongside the active period", () => {
    const start = new Date("2026-10-10T03:00:00Z");
    expect(buildDashboardEventWhere("tcr", ["allowed"], start)).toEqual({
      organizationId: "tcr", status: "PUBLISHED", id: { in: ["allowed"] },
      AND: [
        { OR: [{ startsAt: { gte: start } }, { endsAt: { gte: start } }] },
        { OR: [{ salesEndsAt: null }, { salesEndsAt: { gte: start } }] }
      ]
    });
  });
  it("does not expand an empty event scope", () => {
    expect(buildDashboardEventWhere("tcr", [], new Date()).id).toEqual({ in: [] });
  });
  it("preserves the standard administrative dashboard scope", () => {
    expect(buildDashboardEventWhere("tcr", null)).toEqual({ organizationId: "tcr", status: { not: "DRAFT" } });
  });
});
