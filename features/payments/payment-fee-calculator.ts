export type PaymentFeeSettings = {
  pixTransactionFeeInCents: number;
  cardBaseFeeBps: number;
  cardAdditionalInstallmentFeeBps: number;
};

export function calculateNetTicketAmountInCents(
  subtotalInCents: number,
  discountInCents: number
) {
  return Math.max(subtotalInCents - Math.max(discountInCents, 0), 0);
}

export function calculatePixChargeInCents(
  netTicketAmountInCents: number,
  splitTotalInCents: number,
  settings: PaymentFeeSettings
) {
  return Math.max(netTicketAmountInCents, 0) + Math.max(splitTotalInCents, 0) + Math.max(settings.pixTransactionFeeInCents, 0);
}

export function getCardProcessorFeeBps(installments: number, settings: PaymentFeeSettings) {
  const safeInstallments = Math.max(Math.trunc(installments), 1);
  return Math.max(settings.cardBaseFeeBps, 0) +
    Math.max(safeInstallments - 1, 0) * Math.max(settings.cardAdditionalInstallmentFeeBps, 0);
}

export function calculateCardChargeInCents(
  netTicketAmountInCents: number,
  splitTotalInCents: number,
  installments: number,
  settings: PaymentFeeSettings
) {
  const amountToPreserveInCents = Math.max(netTicketAmountInCents, 0) + Math.max(splitTotalInCents, 0);
  const processorFeeBps = getCardProcessorFeeBps(installments, settings);

  if (processorFeeBps >= 10000) {
    throw new Error("A taxa do cartão precisa ser menor que 100%.");
  }

  return Math.ceil(amountToPreserveInCents / (1 - processorFeeBps / 10000));
}
