import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "lot-new", ...args.data })),
  findMany: vi.fn(async () => []),
  normalize: vi.fn(async () => undefined),
  lock: vi.fn(async () => undefined)
}));

vi.mock("@/features/lots/lot-order.service", () => ({ lockEventLotOrder: mocks.lock, normalizeEventLotOrder: mocks.normalize }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
  event: { findUniqueOrThrow: async () => ({ startsAt: new Date("2026-11-30T23:00:00.000Z"), endsAt: null }) },
  ticketLot: { findMany: mocks.findMany, aggregate: async () => ({ _max: { sortOrder: null } }), create: mocks.create,
    findUniqueOrThrow: async () => ({ id: "lot-new", ...(mocks.create.mock.lastCall?.[0]?.data || {}) }) }
}) } }));

import { applyAssistantLotChanges } from "@/features/lots/lot.service";
import type { AssistantLotChange } from "@/features/assistant/admin-assistant.service";

function directChange(): AssistantLotChange {
  return { operation: "CREATE", lotId: "", templateLotId: "", oldName: "", oldDescription: "", oldPriceInCents: 0,
    oldTotalQuantity: 0, oldStatus: "", name: "Pista inteira", description: "Em pé", priceInCents: 10000,
    totalQuantity: 100, status: "DRAFT", serviceFeeBps: 1500, cardInterestBpsPerInstallment: 200,
    cardInterestStartsAtInstallment: 2 };
}

describe("assistant first lot apply", () => {
  it("creates a first ticket with explicit pricing and normalizes ordering", async () => {
    vi.clearAllMocks();
    await applyAssistantLotChanges("event-1", [directChange()]);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      name: "Pista inteira", priceInCents: 10000, serviceFeeBps: 1500,
      cardInterestBpsPerInstallment: 200, cardInterestStartsAtInstallment: 2, status: "DRAFT"
    }) }));
    expect(mocks.normalize).toHaveBeenCalledWith(expect.anything(), "event-1");
  });

  it("rejects missing explicit fees before creating a ticket", async () => {
    vi.clearAllMocks();
    await expect(applyAssistantLotChanges("event-1", [{ ...directChange(), serviceFeeBps: undefined }])).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
