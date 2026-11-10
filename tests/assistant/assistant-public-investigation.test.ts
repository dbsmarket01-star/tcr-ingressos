import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ event: vi.fn(async () => ({ slug: "test-event" })), allowed: vi.fn<() => string[] | null>(() => null) }));
vi.mock("@/lib/prisma", () => ({ prisma: { event: { findFirst: mocks.event } } }));
vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: mocks.allowed }));
import { executeAssistantInvestigationTool } from "@/features/assistant/assistant-investigation";
const call = { name: "inspect_public_event", arguments: '{"eventId":"test"}' };
afterEach(() => { vi.restoreAllMocks(); mocks.allowed.mockReturnValue(null); });
describe("public verification tool", () => {
  it("reads the actual public page and strips scripts", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('<h1>Evento</h1><p>PISTA - MEIA: R$ 100,00</p><script>hidden()</script>', { status: 200 }));
    const result = JSON.parse(await executeAssistantInvestigationTool({ organizationId: "org" } as never, call));
    expect(result.status).toBe(200); expect(result.text).toContain("PISTA - MEIA"); expect(result.text).not.toContain("hidden");
    expect(fetch).toHaveBeenCalledWith("https://www.tcringressos.app.br/evento/test-event", expect.objectContaining({ redirect: "manual", cache: "no-store" }));
  });
  it("does not call a page outside the user's event scope", async () => {
    mocks.allowed.mockReturnValue([]);
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(await executeAssistantInvestigationTool({ organizationId: "org" } as never, call)).toContain("fora do escopo");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports an unpublished page honestly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Not found", { status: 404 }));
    expect(JSON.parse(await executeAssistantInvestigationTool({ organizationId: "org" } as never, call))).toMatchObject({ status: 404, publicPageAvailable: false });
  });
});
