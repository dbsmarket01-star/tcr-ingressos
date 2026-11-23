import { beforeEach, expect, it, vi } from "vitest";

const asaas = vi.hoisted(() => ({ getPayment: vi.fn(), deletePayment: vi.fn(), findPaymentsByOrderCode: vi.fn() }));
vi.mock("@/features/payments/payment-provider", () => ({ getAsaasProvider: () => asaas }));
vi.mock("@/features/payments/payment-organization-config", () => ({
  getPaymentProviderNameForOrganization: (organization: { slug?: string }) =>
    organization.slug === "tcr-ingressos" ? "ASAAS" : "SIMULATED"
}));

import { paymentAllowsOrderExpiration } from "@/features/orders/order-expiration-payment-guard";

const now = new Date("2026-11-23T15:30:00Z");
const order = {
  code: "TEST",
  expiresAt: new Date(now.getTime() - 3 * 60_000),
  payment: { provider: "ASAAS" as const, status: "PENDING" as const, externalId: "pay_test" },
  event: { organization: { slug: "tcr-ingressos" } }
};

beforeEach(() => vi.resetAllMocks());

it("removes an unpaid standalone Pix before releasing its seat", async () => {
  asaas.getPayment.mockResolvedValue({ status: "PENDING", billingType: "PIX" });
  asaas.deletePayment.mockResolvedValue({ deleted: true });
  expect(await paymentAllowsOrderExpiration(order, now)).toBe(true);
  expect(asaas.deletePayment).toHaveBeenCalledWith("pay_test");
});

it.each(["CONFIRMED", "RECEIVED", "REFUNDED", "OVERDUE"]) (
  "holds a charge with uncertain or completed status %s",
  async (status) => {
    asaas.getPayment.mockResolvedValue({ status, billingType: "CREDIT_CARD" });
    expect(await paymentAllowsOrderExpiration(order, now)).toBe(false);
    expect(asaas.deletePayment).not.toHaveBeenCalled();
  }
);

it("holds a Pix if provider deletion fails", async () => {
  asaas.getPayment.mockResolvedValue({ status: "PENDING", billingType: "PIX" });
  asaas.deletePayment.mockRejectedValue(new Error("Already paid"));
  await expect(paymentAllowsOrderExpiration(order, now)).rejects.toThrow("Already paid");
});

it("does not delete a card installment", async () => {
  asaas.getPayment.mockResolvedValue({ status: "PENDING", billingType: "CREDIT_CARD", installmentCount: 4 });
  expect(await paymentAllowsOrderExpiration(order, now)).toBe(false);
  expect(asaas.deletePayment).not.toHaveBeenCalled();
});

it("keeps an unlinked provider charge that is not a standalone Pix", async () => {
  asaas.findPaymentsByOrderCode.mockResolvedValue([{ status: "PENDING", externalReference: "TEST" }]);
  expect(await paymentAllowsOrderExpiration({ ...order, payment: { provider: "SIMULATED", status: "CREATED", externalId: null } }, now)).toBe(false);
});

it("closes an abandoned unlinked Pix before releasing its reservation", async () => {
  asaas.findPaymentsByOrderCode.mockResolvedValue([{ id: "pay_orphan", status: "PENDING", billingType: "PIX" }]);
  asaas.deletePayment.mockResolvedValue({ deleted: true });
  expect(await paymentAllowsOrderExpiration({ ...order, payment: { provider: "SIMULATED", status: "CREATED", externalId: null } }, now)).toBe(true);
  expect(asaas.deletePayment).toHaveBeenCalledWith("pay_orphan");
});

it("releases an abandoned order only after the in-flight grace and provider search", async () => {
  asaas.findPaymentsByOrderCode.mockResolvedValue([]);
  const unlinked = { ...order, payment: { provider: "SIMULATED" as const, status: "CREATED" as const, externalId: null } };
  expect(await paymentAllowsOrderExpiration(unlinked, new Date(order.expiresAt.getTime() + 60_000))).toBe(false);
  expect(asaas.findPaymentsByOrderCode).not.toHaveBeenCalled();
  expect(await paymentAllowsOrderExpiration(unlinked, now)).toBe(true);
});

it("preserves simulated checkout expiry without accepting another provider's charge", async () => {
  const simulated = { ...order, payment: { provider: "SIMULATED" as const, status: "PENDING" as const, externalId: "sim_test" }, event: { organization: { slug: "test" } } };
  expect(await paymentAllowsOrderExpiration(simulated, now)).toBe(true);
  expect(await paymentAllowsOrderExpiration({ ...simulated, payment: { ...simulated.payment, externalId: "real_123" } }, now)).toBe(false);
});
