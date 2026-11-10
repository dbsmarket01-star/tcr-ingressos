import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), lock: vi.fn(), normalize: vi.fn() }));
vi.mock("@/features/lots/lot-order.service", () => ({ lockEventLotOrder: mocks.lock, normalizeEventLotOrder: mocks.normalize }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ ticketLot: { findUniqueOrThrow: mocks.read, update: mocks.update } }) } }));
import { updateTicketLotPricing } from "@/features/lots/lot.service";
describe("price confirmation under event lock", () => {
  beforeEach(() => vi.resetAllMocks());
  it("refuses a price changed between the route check and lock acquisition", async () => {
    mocks.read.mockResolvedValueOnce({ id: "lot", eventId: "e", priceInCents: 10000 }).mockResolvedValueOnce({ id: "lot", eventId: "e", priceInCents: 12000 });
    await expect(updateTicketLotPricing("lot", { priceInCents: 15000 } as never, 10000)).rejects.toThrow("mudou durante");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("changes only the price, preserving newer fees and discounts", async () => {
    mocks.read.mockResolvedValue({ id: "lot", eventId: "e", priceInCents: 10000, serviceFeeBps: 2000 });
    await updateTicketLotPricing("lot", { priceInCents: 15000, serviceFeeBps: 1000 } as never, 10000);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "lot" }, data: { priceInCents: 15000 } });
    expect(mocks.normalize).toHaveBeenCalledOnce();
  });
});
