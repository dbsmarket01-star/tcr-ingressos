import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const filesToCheck = [
  "features/auth/auth.service.ts",
  "features/customer-auth/google-buyer.service.ts",
  "features/tracking/public-visit.client.ts",
  "features/finance/finance-report.service.ts",
  "app/admin/finance/export/route.ts"
];

describe("tenant technical identifiers", () => {
  it("keeps shared runtime identifiers neutral instead of TCR-specific", () => {
    const source = filesToCheck.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(source).toContain("ingresaas_admin_session");
    expect(source).toContain("ingresaas_buyer_profile");
    expect(source).toContain("ingresaas_public_visitor");
    expect(source).toContain("platformAfterSplitInCents");
    expect(source).not.toContain("const COOKIE_NAME = \"tcr_admin_session\"");
    expect(source).not.toContain("const BUYER_COOKIE_NAME = \"tcr_buyer_profile\"");
    expect(source).not.toContain("const VISITOR_COOKIE_NAME = \"tcr_public_visitor\"");
    expect(source).not.toContain("tcrAfterSplitInCents");
  });
});
