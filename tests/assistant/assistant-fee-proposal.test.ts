import { afterEach, describe, expect, it, vi } from "vitest";
const event = { id: "event", title: "Show Auditoria", city: "São Paulo", slug: "show-auditoria", startsAt: new Date("2027-12-12T21:00:00Z"), status: "DRAFT", updatedAt: new Date(), lots: [{ id: "lot", name: "PISTA", description: "Teste", priceInCents: 10000, status: "PAUSED", totalQuantity: 10, soldQuantity: 0, reservedQuantity: 0, serviceFeeBps: 1000, sortOrder: 0 }] };
vi.mock("@/features/auth/auth.service", () => ({ getAdminAllowedEventIds: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: { event: { findMany: async () => [event] }, adminAuditLog: { findFirst: async () => null, findMany: async () => [], create: async () => ({ id: "p", createdAt: new Date() }) } } }));
import { answerAssistant } from "@/features/assistant/admin-assistant.service";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("explicit ticket fee proposal", () => {
  it.each([["Mude a taxa de bilheteria para 12% do ingresso PISTA no Show Auditoria", 1200], ["Mude a descrição do ingresso PISTA no Show Auditoria", undefined]])("only changes a fee explicitly requested: %s", async (message, fee) => {
    vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({ reply: "Proposta", action: "LOT_CHANGES", eventId: "event", changes: [{ operation: "UPDATE", lotId: "lot", templateLotId: "", name: "PISTA", description: "Teste novo", priceInCents: 10000, totalQuantity: 10, status: "PAUSED", serviceFeeBps: 1200, cardInterestBpsPerInstallment: 0, cardInterestStartsAtInstallment: 1 }] }) }), { status: 200 }));
    const result = await answerAssistant({ id: "admin", organizationId: "org" } as never, message);
    expect(result.proposal?.kind).toBe("LOT_CHANGES");
    if (result.proposal?.kind === "LOT_CHANGES") expect(result.proposal.changes[0].serviceFeeBps).toBe(fee);
  });
});

it("does not lose a requested price change when a color is requested together", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({ reply: "Proposta", action: "LOT_CHANGES", eventId: "event", changes: [{ operation: "UPDATE", lotId: "lot", templateLotId: "", name: "PISTA", description: "Teste", priceInCents: 11000, totalQuantity: 10, status: "PAUSED", highlightColor: "#24865D", serviceFeeBps: 1000, cardInterestBpsPerInstallment: 0, cardInterestStartsAtInstallment: 1 }] }) }), { status: 200 }));
  const result = await answerAssistant({ id: "admin", organizationId: "org" } as never, "Mude a cor do ingresso PISTA no Show Auditoria para #24865D e o preço para R$ 110");
  expect(result.proposal?.kind).toBe("LOT_CHANGES");
  if (result.proposal?.kind === "LOT_CHANGES") expect(result.proposal.changes[0]).toMatchObject({ priceInCents: 11000, highlightColor: "#24865D" });
});

it("prepares an exact status change without making the model reconstruct prices or stock", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const result = await answerAssistant({ id: "admin", organizationId: "org" } as never, "Reative o ingresso PISTA no Show Auditoria. Preserve preço, estoque, cor e taxas.");
  expect(result.proposal?.kind).toBe("LOT_CHANGES");
  if (result.proposal?.kind === "LOT_CHANGES") expect(result.proposal.changes[0]).toMatchObject({ status: "ACTIVE", priceInCents: 10000, totalQuantity: 10, name: "PISTA" });
  expect(fetch).not.toHaveBeenCalled();
});
