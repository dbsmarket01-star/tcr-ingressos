import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/auth.service", () => ({
  requirePermission: vi.fn(async () => ({ organizationId: "org_test" })),
  getAdminAllowedEventIds: vi.fn(() => ["event_test"])
}));
vi.mock("@/features/finance/finance-report.service", () => ({ getFinanceReport: vi.fn() }));

describe("financial exports fail closed", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["CSV", "PDF"])("blocks %s when integrity fails, preserving tenant/event scope", async format => {
    const { getFinanceReport } = await import("@/features/finance/finance-report.service");
    vi.mocked(getFinanceReport).mockResolvedValue({ integrity: { valid: false, issues: ["Total divergente"] } } as Awaited<ReturnType<typeof getFinanceReport>>);
    const { GET } = format === "CSV"
      ? await import("@/app/admin/finance/export/route")
      : await import("@/app/admin/finance/export/pdf/route");
    const response = await GET(new Request("https://example.test/admin/finance/export?eventId=event_test"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "FINANCIAL_INTEGRITY_FAILED", issues: ["Total divergente"] });
    expect(getFinanceReport).toHaveBeenCalledWith(expect.objectContaining({ eventId: "event_test" }), "org_test", ["event_test"]);
  });
});
