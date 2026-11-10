import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  adminAuditLog: {
    findFirst: async () => null,
    findMany: async () => [],
    create: async () => ({ id: "message-1", createdAt: new Date("2026-11-09T12:00:00.000Z") })
  },
  event: { findMany: async () => [] }
} }));

import { answerAssistant } from "@/features/assistant/admin-assistant.service";

describe("assistant investigation loop", () => {
  it("returns tool findings to the model before answering, without writing production data", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const requests: Array<{ url: string; body?: string }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      requests.push({ url: String(url), body: typeof options?.body === "string" ? options.body : undefined });
      if (String(url).includes("api.github.com")) return new Response(JSON.stringify({ tree: [
        { path: "app/admin/events/page.tsx", type: "blob" },
        { path: ".env.local", type: "blob" }
      ] }), { status: 200 });
      if (requests.filter((item) => item.url.includes("api.openai.com")).length === 1) {
        return new Response(JSON.stringify({ output: [{ type: "function_call", call_id: "call-1", name: "find_code_files", arguments: '{"query":"events"}' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: "A tela de eventos está em app/admin/events/page.tsx. Não alterei nada.", action: "NONE", eventId: "", lotId: "", newPriceInCents: 0, newStatus: "", changes: [], eventChanges: [],
        eventDraft: { title: "", slug: "", description: "", startsAt: "", venueName: "", venueAddress: "", city: "", state: "", bannerUrl: "", eventMapImageUrl: "" }
      }) }] }] }), { status: 200 });
    });
    try {
      const result = await answerAssistant({ id: "admin-1", role: "OWNER", organizationId: "org-1" } as Parameters<typeof answerAssistant>[0],
        "Investigue no código como funciona a tela de eventos. Não altere nada.");
      expect(result.proposal).toBeNull();
      expect(result.message.text).toContain("app/admin/events/page.tsx");
      expect(requests.map((item) => item.url)).toEqual([
        "https://api.openai.com/v1/responses",
        expect.stringContaining("api.github.com/repos/dbsmarket01-star/tcr-ingressos/git/trees/"),
        "https://api.openai.com/v1/responses"
      ]);
      const secondInput = JSON.parse(requests[2].body || "{}").input;
      expect(secondInput.at(-1).output).toContain("app/admin/events/page.tsx");
      expect(secondInput.at(-1).output).not.toContain(".env.local");
    } finally {
      fetchMock.mockRestore();
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});
