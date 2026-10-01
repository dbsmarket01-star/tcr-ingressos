import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  access: vi.fn(),
  scope: vi.fn(),
  org: vi.fn(),
  reconcile: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("@/features/auth/auth.service", () => ({
  getCurrentAdmin: mocks.admin,
  canAccessArea: mocks.access,
  getAdminAllowedEventIds: mocks.scope,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findFirst: mocks.org, findFirstOrThrow: mocks.org },
  },
}));
vi.mock("@/features/finance/ledger/store", () => ({
  correctLedgerEntry: vi.fn(),
}));
vi.mock("@/features/finance/ledger/closing.service", async () => {
  const { z } = await import("zod");
  return {
    openingSchema: z.object({}),
    configureLedger: vi.fn(),
    reconcileDailyLedger: mocks.reconcile,
    publishClosing: mocks.publish,
    allocateWithdrawal: vi.fn(),
    resolveFinancialIncident: vi.fn(),
  };
});
import { POST } from "@/app/api/admin/finance/ledger/route";
import {
  GET as scheduledCron,
  POST as cron,
} from "@/app/api/maintenance/reconcile-financial-ledger/route";
const request = (body: unknown, origin = "https://local.test") =>
  new Request("https://local.test/api/admin/finance/ledger", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({
    id: "owner",
    organizationId: "org",
    role: "OWNER",
  });
  mocks.access.mockReturnValue(true);
  mocks.scope.mockReturnValue(null);
  mocks.org.mockResolvedValue({ id: "org" });
  mocks.reconcile.mockResolvedValue({
    status: "BLOCKED",
    differenceInCents: BigInt(1),
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("financial route authorization", () => {
  it("rejects missing session and cross-origin mutations", async () => {
    expect(
      (
        await POST(
          request(
            { operation: "reconcile", date: "2026-09-24" },
            "https://other.test",
          ),
        )
      ).status,
    ).toBe(403);
    mocks.admin.mockResolvedValue(null);
    expect(
      (await POST(request({ operation: "reconcile", date: "2026-09-24" })))
        .status,
    ).toBe(403);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it("rejects restricted-event admins and other organizations", async () => {
    mocks.scope.mockReturnValue(["event"]);
    expect(
      (await POST(request({ operation: "reconcile", date: "2026-09-24" })))
        .status,
    ).toBe(403);
    mocks.scope.mockReturnValue(null);
    mocks.org.mockResolvedValue(null);
    expect(
      (await POST(request({ operation: "reconcile", date: "2026-09-24" })))
        .status,
    ).toBe(403);
  });
  it("requires owner to publish", async () => {
    mocks.admin.mockResolvedValue({
      id: "staff",
      organizationId: "org",
      role: "FINANCE",
    });
    expect(
      (await POST(request({ operation: "publish", closingId: "close" })))
        .status,
    ).toBe(403);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("never accepts a caller-supplied snapshot", async () => {
    expect(
      (
        await POST(
          request({
            operation: "reconcile",
            date: "2026-09-24",
            snapshot: { complete: true },
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it("serializes cents safely and scopes reconciliation to authenticated org", async () => {
    const result = await POST(
      request({ operation: "reconcile", date: "2026-09-24" }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).result.differenceInCents).toBe("1");
    expect(mocks.reconcile).toHaveBeenCalledWith("org", "owner", "2026-09-24");
  });
  it("returns blocked publication without exposing internal errors", async () => {
    mocks.publish.mockRejectedValue(new Error("CLOSING_BLOCKED"));
    const result = await POST(
      request({ operation: "publish", closingId: "close" }),
    );
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: "CLOSING_BLOCKED" });
  });
  it("requires configured exact bearer secret for cron", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await cron(request({ date: "2026-09-24" }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "secret");
    for (const authorization of ["secret", "Bearer wrong"]) {
      const req = request({ date: "2026-09-24" });
      req.headers.set("authorization", authorization);
      expect((await cron(req)).status).toBe(401);
    }
    const req = request({ date: "2026-09-24" });
    req.headers.set("authorization", "Bearer secret");
    expect((await cron(req)).status).toBe(200);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("reconciles the prior São Paulo day when invoked by the scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T15:00:00.000Z"));
    const req = new Request(
      "https://local.test/api/maintenance/reconcile-financial-ledger",
      { headers: { authorization: "Bearer secret" } },
    );
    expect((await scheduledCron(req)).status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith(
      "org",
      "cron:financial-reconciliation",
      "2026-09-29",
    );
    vi.useRealTimers();
  });
});
