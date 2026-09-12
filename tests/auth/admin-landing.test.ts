import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAccessArea, getAdminLandingPath } from "@/features/auth/auth.service";

describe("admin landing by role", () => {
  it("sends check-in operators directly to the scanner", () => {
    expect(canAccessArea(AdminRole.CHECKIN, "CHECKIN")).toBe(true);
    expect(canAccessArea(AdminRole.CHECKIN, "DASHBOARD")).toBe(false);
    expect(getAdminLandingPath(AdminRole.CHECKIN)).toBe("/admin/check-in");
  });

  it.each([
    AdminRole.OWNER,
    AdminRole.MANAGER,
    AdminRole.FINANCE,
    AdminRole.SUPPORT,
    AdminRole.STAFF
  ])("keeps %s on the regular dashboard", (role) => {
    expect(getAdminLandingPath(role)).toBe("/admin");
  });
});
