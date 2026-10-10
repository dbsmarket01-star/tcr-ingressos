import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAccessArea, canAccessEvent, getAdminAllowedEventIds, type AdminArea } from "@/features/auth/auth.service";
import { getAdminNavGroupsForRole } from "@/lib/navigation";

const viewer = { id: "viewer", organizationId: "tcr", name: "Consulta", email: "test@example.com", role: AdminRole.SALES_VIEWER, accessAllEvents: false, allowedEventIds: ["geriatricus"] };
describe("sales-only access", () => {
  it("grants only dashboard and orders, denying writes and operational modules", () => {
    for (const area of ["DASHBOARD", "ORDERS"] as AdminArea[]) expect(canAccessArea(viewer.role, area)).toBe(true);
    for (const area of ["ORDERS_WRITE", "EVENTS", "CRM", "MARKETING", "SUPPORT", "FINANCE", "CHECKIN", "TICKETS", "SECURITY", "SUBSCRIPTIONS", "DEVICES", "INCIDENTS", "CUSTOMERS", "BILLING", "ACCOUNT", "AUDIT", "REPORTS", "PRODUCTION", "SETTINGS", "USERS", "OPERATIONS"] as AdminArea[]) expect(canAccessArea(viewer.role, area), area).toBe(false);
  });
  it("keeps Livia on one event and Carlos on all current and future events", () => {
    expect(canAccessEvent(viewer, "geriatricus")).toBe(true);
    expect(canAccessEvent(viewer, "other-event")).toBe(false);
    expect(getAdminAllowedEventIds(viewer)).toEqual(["geriatricus"]);
    const allEvents = { ...viewer, accessAllEvents: true, allowedEventIds: [] };
    expect(getAdminAllowedEventIds(allEvents)).toBeNull();
    expect(canAccessEvent(allEvents, "future-event")).toBe(true);
    expect(canAccessArea(allEvents.role, "USERS")).toBe(false);
  });
  it("shows only the two requested menu entries", () => {
    expect(getAdminNavGroupsForRole(viewer.role).flatMap(g => g.items.map(i => i.href)).sort()).toEqual(["/admin", "/admin/orders"]);
  });
  it("preserves write access for existing operational roles", () => {
    for (const role of [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE, AdminRole.SUPPORT, AdminRole.STAFF]) expect(canAccessArea(role, "ORDERS_WRITE")).toBe(true);
  });
});
