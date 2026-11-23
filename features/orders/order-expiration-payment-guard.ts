import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { getAsaasProvider } from "@/features/payments/payment-provider";
import type { AsaasPaymentStatusResponse } from "@/features/payments/payment-provider";
import { getPaymentProviderNameForOrganization } from "@/features/payments/payment-organization-config";

type ExpiringOrder = {
  code: string;
  expiresAt: Date | null;
  payment: {
    provider: PaymentProvider;
    status: PaymentStatus;
    externalId: string | null;
  } | null;
  event: {
    organization: { id?: string | null; slug?: string | null; name?: string | null } | null;
  };
};

function isClosedAsaasCharge(charge: AsaasPaymentStatusResponse) {
  return ["DELETED", "CANCELED", "CANCELLED"].includes(charge.status?.toUpperCase() || "");
}

async function closeUnpaidPix(asaas: ReturnType<typeof getAsaasProvider>, charge: AsaasPaymentStatusResponse) {
  if (isClosedAsaasCharge(charge)) return true;
  const status = charge.status?.toUpperCase();
  if (!charge.id || (status !== "PENDING" && status !== "OVERDUE") ||
      charge.billingType !== "PIX" || charge.installment || charge.installmentCount) return false;
  await asaas.deletePayment(charge.id);
  return true;
}

/** A failed provider call must leave the reservation in place, never release it. */
export async function paymentAllowsOrderExpiration(order: ExpiringOrder, now: Date): Promise<boolean> {
  if (!order.payment || order.payment.status === PaymentStatus.APPROVED) return false;

  const organization = order.event.organization;
  const configuredProvider = getPaymentProviderNameForOrganization(organization);
  const externalId = order.payment.externalId;

  // A simulated test reference is not payable outside the application.
  if (externalId && order.payment.provider === PaymentProvider.SIMULATED &&
      configuredProvider === "SIMULATED" && externalId.startsWith("sim_")) return true;
  // A real external charge from another provider cannot be safely canceled here.
  if (externalId && order.payment.provider !== PaymentProvider.ASAAS) return false;
  if (order.payment.provider === PaymentProvider.ASAAS && !externalId) return false;

  if (externalId) {
    const asaas = getAsaasProvider(organization);
    const remote = await asaas.getPayment(externalId);
    // Only a standalone unpaid Pix may be removed automatically. Card charges
    // and installments can still be processing after the local deadline.
    return closeUnpaidPix(asaas, { ...remote, id: externalId });
  }

  if (configuredProvider === "ASAAS") {
    // Allow an in-flight payment creation to finish before searching by the
    // immutable order reference. An unlinked charge must never be released.
    if (!order.expiresAt || now.getTime() - order.expiresAt.getTime() < 2 * 60_000) return false;
    const asaas = getAsaasProvider(organization);
    const charges = await asaas.findPaymentsByOrderCode(order.code);
    // Several charges may be one card installment plan or an ambiguous
    // duplicate payment. Neither can be automatically released.
    if (charges.length > 1) return charges.every(isClosedAsaasCharge);
    if (charges.length === 1) return closeUnpaidPix(asaas, charges[0]);
    return true;
  }

  return configuredProvider === "SIMULATED";
}
