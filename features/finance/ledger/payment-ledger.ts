import { type Tx, appendEntry, incident, lockAccount } from "./store";
import { dayKey, proportionalRefund, type EntryKind } from "./rules";

function refundDate(raw: unknown): string | null {
  const root = raw as {
    payment?: { refunds?: Array<{ dateCreated?: string; status?: string }> };
    refunds?: Array<{ dateCreated?: string; status?: string }>;
  } | null;
  const dates = (root?.payment?.refunds ?? root?.refunds ?? [])
    .filter((x) => x.status === "DONE")
    .map((x) => x.dateCreated?.slice(0, 10))
    .filter((x): x is string => Boolean(x && /^\d{4}-\d{2}-\d{2}$/.test(x)));
  return dates.length && new Set(dates).size === 1 ? dates[0] : null;
}
/** Called inside the payment's existing transaction. No provider requests or external effects. */
export async function recordOrderFinancialState(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { payment: true, event: { select: { organizationId: true } } },
  });
  if (!order || order.payment?.provider !== "ASAAS" || !order.paidAt) return;
  const organizationId = order.event.organizationId;
  const config = await tx.financialLedgerAccount.findUnique({
    where: { organizationId },
  });
  if (!config) return; // Explicit audited onboarding; never guess historical opening balances.
  await lockAccount(tx, organizationId);
  if (dayKey(order.paidAt) < config.startsOn.toISOString().slice(0, 10)) return;
  const principal =
    order.totalInCents - order.serviceFeeInCents - order.cardInterestInCents;
  if (principal < 0 || order.refundedInCents > order.totalInCents) {
    await incident(
      tx,
      organizationId,
      `invalid-order:${order.id}`,
      "INVALID_ORDER_AMOUNTS",
      order.paidAt,
      { orderId },
    );
    return;
  }
  const common = {
    orderId,
    paymentId: order.payment.id,
    externalPaymentId: order.payment.externalId ?? undefined,
    metadata: { orderCode: order.code },
  };
  const saleDate = dayKey(order.paidAt);
  for (const [type, amount] of [
    ["SALE_PRINCIPAL", principal],
    ["SERVICE_FEE", order.serviceFeeInCents],
    ["CARD_INTEREST", order.cardInterestInCents],
    ["RECEIVABLE_OPEN", order.totalInCents],
  ] as [EntryKind, number][]) {
    if (amount > 0)
      await appendEntry(tx, organizationId, {
        ...common,
        type,
        amountInCents: amount,
        sourceKey: `order:${orderId}:${type}`,
        effectiveDate: saleDate,
        verified: true,
        evidence: `Order.paidAt / ${order.code}`,
      });
  }
  if (!order.refundedInCents) return;
  const allocated = proportionalRefund(
    order.totalInCents,
    order.serviceFeeInCents,
    order.cardInterestInCents,
    order.refundedInCents,
  );
  const previous = await tx.financialLedgerEntry.findMany({
    where: {
      organizationId,
      orderId,
      type: { in: ["REFUND_PRINCIPAL", "REFUND_FEE", "REFUND_INTEREST"] },
      reversals: { none: {} },
    },
  });
  const targets: [EntryKind, number][] = [
    ["REFUND_PRINCIPAL", allocated.principal],
    ["REFUND_FEE", allocated.fee],
    ["REFUND_INTEREST", allocated.interest],
  ];
  const deltas: [EntryKind, number][] = [];
  for (const [type, total] of targets) {
    const recorded = previous
      .filter((x) => x.type === type)
      .reduce((n, x) => n + Number(x.amountInCents), 0);
    if (total < recorded)
      await incident(
        tx,
        organizationId,
        `refund-regression:${orderId}:${type}`,
        "REFUND_REGRESSION",
        new Date(),
        { total, recorded },
      );
    if (total > recorded) deltas.push([type, total - recorded]);
  }
  if (!deltas.length) return;
  const effectiveDate = refundDate(order.payment.rawPayload);
  // Ambiguous/missing dates are observations, not proven settlement dates.
  const observedDate = effectiveDate ?? dayKey(new Date());
  if (!effectiveDate)
    await incident(
      tx,
      organizationId,
      `refund-date:${orderId}:${order.refundedInCents}`,
      "REFUND_EFFECTIVE_DATE_MISSING",
      new Date(),
      { orderId, refundedInCents: order.refundedInCents },
    );
  for (const [type, amountInCents] of deltas)
    await appendEntry(tx, organizationId, {
      ...common,
      type,
      amountInCents,
      sourceKey: `order:${orderId}:${type}:${order.refundedInCents}`,
      effectiveDate: observedDate,
      verified: Boolean(effectiveDate),
      evidence: effectiveDate
        ? "Asaas refund DONE dateCreated"
        : "Webhook observation only; effective date unresolved",
    });
}
