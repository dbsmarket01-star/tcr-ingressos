type RefundableOrderAmounts = {
  totalInCents: number;
  subtotalInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
  discountInCents?: number;
  pixDiscountInCents?: number;
  refundedInCents?: number;
};

function scale(value: number, remainingInCents: number, totalInCents: number) {
  if (totalInCents <= 0) return 0;
  return Math.max(Math.round(value * (remainingInCents / totalInCents)), 0);
}

export function allocateOrderAmountsAfterRefund<T extends RefundableOrderAmounts>(order: T) {
  const refundedInCents = Math.min(Math.max(order.refundedInCents ?? 0, 0), order.totalInCents);
  const remainingInCents = Math.max(order.totalInCents - refundedInCents, 0);

  return {
    totalInCents: remainingInCents,
    subtotalInCents: scale(order.subtotalInCents, remainingInCents, order.totalInCents),
    serviceFeeInCents: scale(order.serviceFeeInCents, remainingInCents, order.totalInCents),
    cardInterestInCents: scale(order.cardInterestInCents, remainingInCents, order.totalInCents),
    discountInCents: scale(order.discountInCents ?? 0, remainingInCents, order.totalInCents),
    pixDiscountInCents: scale(order.pixDiscountInCents ?? 0, remainingInCents, order.totalInCents),
    refundedInCents
  };
}
