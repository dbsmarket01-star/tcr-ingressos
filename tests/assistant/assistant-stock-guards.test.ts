import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ current: vi.fn(), update: vi.fn() }));
vi.mock("@/features/lots/lot-order.service", () => ({ lockEventLotOrder: vi.fn(), normalizeEventLotOrder: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ event: { findUniqueOrThrow: async () => ({ startsAt: new Date() }) }, ticketLot: { findMany: mocks.current, update: mocks.update } }) } }));
import { applyAssistantLotChanges } from "@/features/lots/lot.service";
const lot = { id: "l", name: "Pista", description: "Teste", priceInCents: 10000, totalQuantity: 10, soldQuantity: 4, reservedQuantity: 2, status: "ACTIVE", hasTypeOptions: false };
const change = { operation: "UPDATE" as const, lotId: "l", templateLotId: "", oldName: "Pista", oldDescription: "Teste", oldPriceInCents: 10000, oldTotalQuantity: 10, oldStatus: "ACTIVE", name: "Pista", description: "Teste", priceInCents: 10000, totalQuantity: 8, status: "ACTIVE" as const };
describe("assistant stock and stale-state guards", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.current.mockResolvedValue([lot]); });
  it("does not reduce stock below sold plus reserved tickets", async () => {
    await expect(applyAssistantLotChanges("e", [{ ...change, totalQuantity: 5 }])).rejects.toThrow("vendidos ou reservados");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not overwrite a ticket edited after the proposal", async () => {
    mocks.current.mockResolvedValue([{ ...lot, priceInCents: 11000 }]);
    await expect(applyAssistantLotChanges("e", [change])).rejects.toThrow("mudou desde a proposta");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not bypass stock configuration of numbered ticket options", async () => {
    mocks.current.mockResolvedValue([{ ...lot, hasTypeOptions: true }]);
    await expect(applyAssistantLotChanges("e", [change])).rejects.toThrow("cadastro completo");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
