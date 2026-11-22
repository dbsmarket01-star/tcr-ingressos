import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { validateTicketForCheckIn } from "@/features/check-in/check-in.service";
const usedAt = new Date("2026-11-21T23:00:00Z");
const ticket = { id: "synthetic", code: "SYNTHETIC", status: "ACTIVE", usedAt: null, eventId: "event", event: { title: "Synthetic", organization: { publicDomain: "example.test" } }, lot: { name: "Test" }, lotOption: null, order: { status: "PAID", customer: { name: "Synthetic" } } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((callback) => callback({ ticket: mocks, checkIn: { create: mocks.create } }));
  mocks.findFirst.mockResolvedValue(ticket);
  mocks.updateMany.mockResolvedValue({ count: 1 });
});
it("does not admit an already used ticket and returns its first validation", async () => {
  mocks.findFirst.mockResolvedValue({ ...ticket, status: "USED", usedAt });
  const result = await validateTicketForCheckIn("SYNTHETIC");
  expect(result.status).toBe("ALREADY_USED");
  expect(result.ticket?.checkedAt).toEqual(usedAt);
  expect(mocks.updateMany).not.toHaveBeenCalled();
  expect(mocks.create.mock.calls[0][0].data.status).toBe("ALREADY_USED");
});
it("reads the first validation when conditional update loses a race", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.findUnique.mockResolvedValue({ status: "USED", usedAt });
  expect((await validateTicketForCheckIn("SYNTHETIC")).ticket?.checkedAt).toEqual(usedAt);
  expect(mocks.create.mock.calls[0][0].data.status).toBe("ALREADY_USED");
});
it("does not label cancellation during validation as an earlier admission", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.findUnique.mockResolvedValue({ status: "CANCELED", usedAt: null });
  await expect(validateTicketForCheckIn("SYNTHETIC")).rejects.toThrow("concorrente");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("never blindly retries an aborted or ambiguous transaction", async () => {
  for (const code of ["P2034", "CONNECTION_CLOSED"]) {
    mocks.transaction.mockRejectedValueOnce(Object.assign(new Error("uncertain"), { code }));
    await expect(validateTicketForCheckIn("SYNTHETIC")).rejects.toThrow("uncertain");
  }
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
  expect(mocks.create).not.toHaveBeenCalled();
});
