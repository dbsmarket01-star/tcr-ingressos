import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ cookies: new Map<string, string>(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => state.cookies.has(name) ? { value: state.cookies.get(name) } : undefined,
    delete: (name: string) => state.cookies.delete(name)
  })
}));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));
import { getCurrentAdmin } from "@/features/auth/auth.service";
import { logoutAction } from "@/features/auth/auth.actions";

describe("logout", () => {
  beforeEach(() => { state.cookies.clear(); state.redirect.mockClear(); });
  it("removes current and legacy sessions before redirecting to login", async () => {
    state.cookies.set("ingresaas_admin_session", "current-session");
    state.cookies.set("tcr_admin_session", "legacy-session");
    state.cookies.set("unrelated", "keep");
    state.redirect.mockImplementationOnce((path) => {
      expect(state.cookies.has("ingresaas_admin_session")).toBe(false);
      expect(state.cookies.has("tcr_admin_session")).toBe(false);
      expect(path).toBe("/login");
    });
    await logoutAction();
    expect(await getCurrentAdmin()).toBeNull();
    expect(state.cookies.get("unrelated")).toBe("keep");
    expect(state.redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });
  it("also permits logout after a session has already expired", async () => {
    await logoutAction();
    expect(await getCurrentAdmin()).toBeNull();
    expect(state.redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });
});
