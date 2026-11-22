import { afterEach, expect, it, vi } from "vitest";
const { count } = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { checkIn: { count } } }));
import { getCheckInStats } from "@/features/check-in/check-in.service";
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
it("keeps event and operator totals above 20 across midnight UTC and scopes all queries", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T00:55:00Z"));
  count.mockImplementation(({ where }) => Promise.resolve(where.adminUserId ? 301 : where.checkedAt ? 23 : 851));
  const result = await getCheckInStats("org", ["event"], "operator");
  expect(result.approvedTotal).toBe(851);
  expect(result.operatorApprovedTotal).toBe(301);
  const queries = count.mock.calls.map(([arg]) => arg);
  for (const query of queries) {
    expect(query.where.event.organizationId).toBe("org");
    expect(query.where.eventId).toEqual({ in: ["event"] });
    expect(query).not.toHaveProperty("take");
  }
  for (const query of queries.slice(0, 3)) {
    expect(query.where.checkedAt.gte.toISOString()).toBe("2026-11-21T03:00:00.000Z");
  }
  for (const query of queries.slice(3)) {
    expect(query.where.status).toBe("APPROVED");
    expect(query.where).not.toHaveProperty("checkedAt");
  }
  expect(queries[4].where.adminUserId).toBe("operator");
  vi.setSystemTime(new Date("2026-11-22T04:00:00Z"));
  expect((await getCheckInStats("org", ["event"], "operator")).operatorApprovedTotal).toBe(301);
});
it("does not attribute all operators' validations to a missing operator", async () => {
  count.mockResolvedValue(500);
  expect((await getCheckInStats("org", [])).operatorApprovedTotal).toBe(0);
  expect(count).toHaveBeenCalledTimes(4);
  expect(count.mock.calls.every(([arg]) => arg.where.eventId.in.length === 0)).toBe(true);
});
